//Firebase Configuration & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics.js";
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";
import {getFirestore,collection,addDoc,getDocs,doc,getDoc,updateDoc,deleteDoc,query,where,serverTimestamp} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";
import {getStorage,ref,uploadBytes,getDownloadURL,deleteObject} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js";

//web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDnudweYEeK60I6hOiDTDoPFRccdZVSzRo",
    authDomain: "login-b9d13.firebaseapp.com",
    databaseURL: "https://login-b9d13-default-rtdb.firebaseio.com",
    projectId: "login-b9d13",
    storageBucket: "login-b9d13.firebasestorage.app",
    messagingSenderId: "604017912877",
    appId: "1:604017912877:web:fc6d07512d6eeadf409ca4",
    measurementId: "G-J87HG684C8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global Variables / State
let currentUser = null;
let currentUserRole = null; // Store the role of the currently logged-in user

// Helper Functions 
function showMessage(message, type = 'success') {
    alert(`${type.toUpperCase()}: ${message}`);
}

function redirectTo(path) {
    window.location.href = path;
}

// Navigation & UI Updates
async function updateNavUI(user) {
    const navAuthLinks = document.getElementById('nav-auth-links');
    const navLogout = document.getElementById('nav-logout');
    const navDashboard = document.getElementById('nav-dashboard');
    const navAdmin = document.getElementById('nav-admin');

    if (navAuthLinks && navLogout && navDashboard && navAdmin) {
        if (user) {
            navAuthLinks.style.display = 'none';
            navLogout.style.display = 'list-item';
            
            // Get user role from Firestore
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    currentUserRole = userDoc.data().role;
                    if (currentUserRole === 'admin') {
                        navAdmin.style.display = 'list-item';
                        navDashboard.style.display = 'none'; // Admin has their own panel, seller dashboard is not primary for them
                    } else { // user role (seller)
                        navDashboard.style.display = 'list-item';
                        navAdmin.style.display = 'none';
                    }
                } else {
                    // User doc doesn't exist, this shouldn't happen if signup worked. Default to user.
                    currentUserRole = 'user';
                    navDashboard.style.display = 'list-item';
                    navAdmin.style.display = 'none';
                }
            } catch (error) {
                console.error("Error getting user role:", error);
                currentUserRole = 'user'; // Fallback
                navDashboard.style.display = 'list-item';
                navAdmin.style.display = 'none';
            }
        } else {
            // No user logged in
            navAuthLinks.style.display = 'list-item';
            navLogout.style.display = 'none';
            navDashboard.style.display = 'none';
            navAdmin.style.display = 'none';
            currentUserRole = null;
        }
    }
}

// Authentication Handlers
async function handleSignup(event) {
    event.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // All new signups are 'user' (seller) by default. Admin accounts must be manually set in Firestore.
        await setDoc(doc(db, 'users', user.uid), { // Use setDoc for consistency with user ID as document ID
            uid: user.uid,
            email: user.email,
            role: 'user', // New users are sellers by default
            createdAt: serverTimestamp()
        });

        showMessage('Signup successful! Redirecting to your seller dashboard...', 'success');
        redirectTo('user_dashboard.html'); // Redirect to seller dashboard after signup
    } catch (error) {
        showMessage(`Signup failed: ${error.message}`, 'error');
        console.error("Signup error:", error);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        let role = 'user'; 

        if (userDoc.exists()) {
            role = userDoc.data().role;
        } else {
            // This case should ideally not happen if signup creates doc, but for robustness:
            console.warn("User doc not found after login, creating default 'user' role.");
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                role: 'user', 
                createdAt: serverTimestamp()
            });
        }

        showMessage('Login successful! Redirecting...', 'success');
        if (role === 'admin') {
            redirectTo('admin_dashboard.html');
        } else { // 'user' role (seller)
            redirectTo('user_dashboard.html');
        }

    } catch (error) {
        showMessage(`Login failed: ${error.message}`, 'error');
        console.error("Login error:", error);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showMessage('Logged out successfully.', 'success');
        redirectTo('index.html'); // Redirect to homepage after logout
    } catch (error) {
        showMessage(`Logout failed: ${error.message}`, 'error');
        console.error("Logout error:", error);
    }
}

// Product Management (For Sellers & Admins)

// Function to add a product (used by seller)
async function addProduct(event) {
    event.preventDefault();
    if (!currentUser) {
        showMessage('You must be logged in to add products.', 'error');
        return;
    }

    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const imageFile = document.getElementById('product-image').files[0];

    if (!imageFile) {
        showMessage('Please upload an image for the product.', 'error');
        return;
    }

    try {
        // Upload image to Firebase Storage
        const storageRef = ref(storage, `product_images/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        const imageUrl = await getDownloadURL(snapshot.ref);

        // Add product data to Firestore, including seller ID
        await addDoc(collection(db, 'products'), {
            name,
            description,
            price,
            imageUrl,
            sellerId: currentUser.uid, // Store the ID of the seller
            sellerEmail: currentUser.email, // Store seller email for easier admin view
            createdAt: serverTimestamp()
        });

        showMessage('Product added successfully!', 'success');
        document.getElementById('add-product-form').reset(); // Clear form
        displaySellerProducts(); // Refresh seller's product list
    } catch (error) {
        showMessage(`Error adding product: ${error.message}`, 'error');
        console.error("Error adding product:", error);
    }
}

// Function to display products for the current seller
async function displaySellerProducts() {
    const productListDiv = document.getElementById('seller-product-list');
    if (!productListDiv || !currentUser) return;

    productListDiv.innerHTML = 'Loading your products...';
    try {
        // Query products where sellerId matches current user's UID
        const q = query(collection(db, 'products'), where('sellerId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        productListDiv.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            productListDiv.innerHTML = '<p>You have not uploaded any products yet.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const product = doc.data();
            const productId = doc.id;
            const productCard = document.createElement('div');
            productCard.className = 'admin-product-card'; // Reusing admin-product-card style
            productCard.innerHTML = `
                <img src="${product.imageUrl || 'https://www.shutterstock.com/image-photo/hyderabadi-chicken-biryani-aromatic-flavorful-260nw-2497040151.jpg'}" alt="${product.name}">
                <div class="admin-product-card-content">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <div class="price">₹${product.price.toFixed(2)}</div>
                    <div class="actions">
                        <button class="edit-btn" data-id="${productId}">Edit</button>
                        <button class="delete-btn" data-id="${productId}" data-image="${product.imageUrl}">Delete</button>
                    </div>
                </div>
            `;
            productListDiv.appendChild(productCard);
        });

        // Add event listeners for edit/delete
        productListDiv.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => editProductPrompt(e.target.dataset.id));
        });
        productListDiv.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => deleteProduct(e.target.dataset.id, e.target.dataset.image));
        });

    } catch (error) {
        showMessage(`Error displaying your products: ${error.message}`, 'error');
        console.error("Error displaying seller products:", error);
    }
}

// Function to display ALL products (for Admin)
async function displayAllProductsForAdmin() {
    const productListDiv = document.getElementById('all-products-list');
    if (!productListDiv || currentUserRole !== 'admin') return;

    productListDiv.innerHTML = 'Loading all products...';
    try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        productListDiv.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            productListDiv.innerHTML = '<p>No products available yet.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const product = doc.data();
            const productId = doc.id;
            const productCard = document.createElement('div');
            productCard.className = 'admin-product-card';
            productCard.innerHTML = `
                <img src="${product.imageUrl || 'https://www.shutterstock.com/image-photo/hyderabadi-chicken-biryani-aromatic-flavorful-260nw-2497040151.jpg'}" alt="${product.name}">
                <div class="admin-product-card-content">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <div class="price">₹${product.price.toFixed(2)}</div>
                    <p><small>Seller: ${product.sellerEmail || 'N/A'}</small></p>
                    <div class="actions">
                        <button class="edit-btn" data-id="${productId}">Edit</button>
                        <button class="delete-btn" data-id="${productId}" data-image="${product.imageUrl}">Delete</button>
                    </div>
                </div>
            `;
            productListDiv.appendChild(productCard);
        });

        // Add event listeners for edit/delete
        productListDiv.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => editProductPrompt(e.target.dataset.id, true)); // Pass true for admin edit
        });
        productListDiv.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => deleteProduct(e.target.dataset.id, e.target.dataset.image, true)); // Pass true for admin delete
        });

    } catch (error) {
        showMessage(`Error displaying all products: ${error.message}`, 'error');
        console.error("Error displaying all products:", error);
    }
}

async function editProductPrompt(productId, isAdminEdit = false) {
    try {
        const productDocRef = doc(db, 'products', productId);
        const productDoc = await getDoc(productDocRef);
        if (!productDoc.exists()) {
            showMessage('Product not found.', 'error');
            return;
        }
        const product = productDoc.data();

        // Ensure only seller can edit their own product, or an admin can edit any
        if (!isAdminEdit && product.sellerId !== currentUser.uid) {
            showMessage('You are not authorized to edit this product.', 'error');
            return;
        }

        const newName = prompt('Enter new product name:', product.name);
        if (newName === null) return; // User cancelled

        const newDescription = prompt('Enter new product description:', product.description);
        if (newDescription === null) return;

        const newPrice = prompt('Enter new product price:', product.price);
        if (newPrice === null) return;
        const parsedPrice = parseFloat(newPrice);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            showMessage('Invalid price entered. Price must be a positive number.', 'error');
            return;
        }

        await updateDoc(productDocRef, {
            name: newName,
            description: newDescription,
            price: parsedPrice
        });

        showMessage('Product updated successfully!', 'success');
        if (isAdminEdit) {
            displayAllProductsForAdmin(); // Refresh admin list
        } else {
            displaySellerProducts(); // Refresh seller's list
        }
    } catch (error) {
        showMessage(`Error updating product: ${error.message}`, 'error');
        console.error("Error updating product:", error);
    }
}

async function deleteProduct(productId, imageUrl, isAdminDelete = false) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }

    try {
        const productDocRef = doc(db, 'products', productId);
        const productDoc = await getDoc(productDocRef);
        if (!productDoc.exists()) {
            showMessage('Product not found.', 'error');
            return;
        }
        const product = productDoc.data();

        // Ensure only seller can delete their own product, or an admin can delete any
        if (!isAdminDelete && product.sellerId !== currentUser.uid) {
            showMessage('You are not authorized to delete this product.', 'error');
            return;
        }

        // Delete image from Storage if it exists
        if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
            const imageRef = ref(storage, imageUrl);
             await deleteObject(imageRef); // Correct function to delete from storage
        }

        // Delete product from Firestore
        await deleteDoc(productDocRef);

        showMessage('Product deleted successfully!', 'success');
        if (isAdminDelete) {
            displayAllProductsForAdmin(); // Refresh admin list
        } else {
            displaySellerProducts(); // Refresh seller's list
        }
    } catch (error) {
        showMessage(`Error deleting product: ${error.message}`, 'error');
        console.error("Error deleting product:", error);
    }
}


// Product Display (Customer View currently not distinct, will adapt user_dashboard's product display logic)
// Note: This function is currently not used directly as there's no dedicated 'customer products' page.
// If we add a page like 'browse_products.html', we'd call this there.
async function displayCustomerProducts() {
    const productListDiv = document.getElementById('product-list'); // Assumes an element with this ID
    if (!productListDiv) return;

    productListDiv.innerHTML = 'Loading products...';
    try {
        const querySnapshot = await getDocs(collection(db, 'products')); // Get all products
        productListDiv.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            productListDiv.innerHTML = '<p>No products available yet.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const product = doc.data();
            const productId = doc.id;
            const productCard = document.createElement('div');
            productCard.className = 'product-card'; // Using the customer-facing product card style
            productCard.innerHTML = `
                <img src="${product.imageUrl || 'https://www.shutterstock.com/image-photo/hyderabadi-chicken-biryani-aromatic-flavorful-260nw-2497040151.jpg'}" alt="${product.name}">
                <div class="product-card-content">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <div class="price">₹${product.price.toFixed(2)}</div>
                    <p><small>By: ${product.sellerEmail || 'N/A'}</small></p>
                    <button class="add-to-cart-btn" data-id="${productId}" 
                            data-name="${product.name}" 
                            data-price="${product.price}">Add to Cart</button>
                </div>
            `;
            productListDiv.appendChild(productCard);
        });

        // Add event listeners for "Add to Cart"
        productListDiv.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const productName = e.target.dataset.name;
                const productPrice = parseFloat(e.target.dataset.price);
                addToCart(productId, productName, productPrice);
            });
        });

    } catch (error) {
        showMessage(`Error displaying products for customers: ${error.message}`, 'error');
        console.error("Error displaying customer products:", error);
    }
}

// Cart & Order Management (User - Customer perspective)
let cart = JSON.parse(localStorage.getItem('userCart')) || []; // Load cart from local storage

function saveCart() {
    localStorage.setItem('userCart', JSON.stringify(cart));
}

function addToCart(productId, name, price) {
    const existingItemIndex = cart.findIndex(item => item.id === productId);
    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += 1;
    } else {
        cart.push({ id: productId, name, price, quantity: 1 });
    }
    saveCart();
    showMessage(`${name} added to cart!`, 'success');
    displayCart(); // Refresh cart display if on cart page
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    showMessage('Item removed from cart.', 'info');
    displayCart();
}

function updateCartQuantity(productId, newQuantity) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        newQuantity = parseInt(newQuantity);
        if (newQuantity > 0) {
            cart[itemIndex].quantity = newQuantity;
        } else {
            cart.splice(itemIndex, 1); // Remove if quantity is 0
        }
        saveCart();
        displayCart();
    }
}

function displayCart() {
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalPriceSpan = document.getElementById('cart-total-price');
    if (!cartItemsDiv || !cartTotalPriceSpan) return;

    cartItemsDiv.innerHTML = '';
    let totalPrice = 0;

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p>Your cart is empty.</p>';
        cartTotalPriceSpan.textContent = '0.00';
        const placeOrderBtn = document.getElementById('place-order-btn');
        if (placeOrderBtn) placeOrderBtn.disabled = true;
        return;
    }

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        totalPrice += itemTotal;

        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';
        cartItemDiv.innerHTML = `
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <p>Price: ₹${item.price.toFixed(2)}</p>
            </div>
            <div class="cart-item-actions">
                <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" data-id="${item.id}">
                <span>₹${itemTotal.toFixed(2)}</span>
                <button class="remove-btn" data-id="${item.id}">Remove</button>
            </div>
        `;
        cartItemsDiv.appendChild(cartItemDiv);
    });

    cartTotalPriceSpan.textContent = totalPrice.toFixed(2);
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) placeOrderBtn.disabled = false;

    // Add event listeners for quantity change and remove
    cartItemsDiv.querySelectorAll('.item-quantity-input').forEach(input => {
        input.addEventListener('change', (e) => {
            updateCartQuantity(e.target.dataset.id, e.target.value);
        });
    });
    cartItemsDiv.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            removeFromCart(e.target.dataset.id);
        });
    });
}

async function placeOrder() {
    if (cart.length === 0) {
        showMessage('Your cart is empty. Please add items before placing an order.', 'error');
        return;
    }
    if (!currentUser) {
        showMessage('You must be logged in to place an order.', 'error');
        redirectTo('auth.html');
        return;
    }

    if (!confirm('Confirm placing this order?')) {
        return;
    }

    try {
        const orderTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        await addDoc(collection(db, 'orders'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            items: cart,
            total: orderTotal,
            status: 'Pending', // Initial status
            orderDate: serverTimestamp()
        });

        cart = []; // Clear local cart
        saveCart();
        showMessage('Order placed successfully!', 'success');
        displayCart(); // Update cart display (will show empty cart)
        displayUserOrders(); // Refresh past orders list
    } catch (error) {
        showMessage(`Error placing order: ${error.message}`, 'error');
        console.error("Error placing order:", error);
    }
}

async function displayUserOrders() {
    const pastOrdersDiv = document.getElementById('past-orders');
    if (!pastOrdersDiv || !currentUser) return;

    pastOrdersDiv.innerHTML = 'Loading your orders...';
    try {
        const q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        pastOrdersDiv.innerHTML = '';

        if (querySnapshot.empty) {
            pastOrdersDiv.innerHTML = '<p>You have not placed any orders yet.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.orderDate ? new Date(order.orderDate.seconds * 1000).toLocaleString() : 'N/A';
            const orderProducts = order.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
            
            const orderItemDiv = document.createElement('div');
            orderItemDiv.className = 'order-item';
            orderItemDiv.innerHTML = `
                <div class="order-item-details">
                    <h4>Order ID: ${doc.id.substring(0, 8)}...</h4>
                    <p>Date: ${orderDate}</p>
                    <p>Total: ₹${order.total.toFixed(2)}</p>
                    <p>Status: <span class="status-${order.status.toLowerCase()}">${order.status}</span></p>
                </div>
                <div class="order-products">
                    Items: ${orderProducts}
                </div>
            `;
            pastOrdersDiv.appendChild(orderItemDiv);
        });

    } catch (error) {
        showMessage(`Error fetching your orders: ${error.message}`, 'error');
        console.error("Error fetching user orders:", error);
    }
}

// Order Management (Admin)
async function displayAllOrders() {
    const allOrdersListDiv = document.getElementById('all-orders-list');
    if (!allOrdersListDiv || currentUserRole !== 'admin') return;

    allOrdersListDiv.innerHTML = 'Loading all orders...';
    try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        allOrdersListDiv.innerHTML = '';

        if (querySnapshot.empty) {
            allOrdersListDiv.innerHTML = '<p>No orders placed yet.</p>';
            return;
        }

        querySnapshot.forEach(docSnapshot => {
            const order = docSnapshot.data();
            const orderId = docSnapshot.id;
            const orderDate = order.orderDate ? new Date(order.orderDate.seconds * 1000).toLocaleString() : 'N/A';
            const orderProducts = order.items.map(item => `${item.name} (x${item.quantity})`).join(', ');

            const orderItemDiv = document.createElement('div');
            orderItemDiv.className = 'admin-order-item';
            orderItemDiv.innerHTML = `
                <div class="admin-order-item-header">
                    <h4>Order ID: ${orderId.substring(0, 8)}... (User: ${order.userEmail})</h4>
                    <p>Date: ${orderDate}</p>
                </div>
                <div class="admin-order-details">
                    <p>Total: ₹${order.total.toFixed(2)}</p>
                    <p>Current Status: <span id="status-${orderId}" class="status-${order.status.toLowerCase()}">${order.status}</span></p>
                    <div class="admin-order-products">Items: ${orderProducts}</div>
                </div>
                <div class="admin-order-actions">
                    <select id="status-select-${orderId}" data-id="${orderId}">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    <button class="update-status-btn" data-id="${orderId}">Update Status</button>
                </div>
            `;
            allOrdersListDiv.appendChild(orderItemDiv);
        });

        // Add event listeners for status updates
        allOrdersListDiv.querySelectorAll('.update-status-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const orderId = e.target.dataset.id;
                const selectElement = document.getElementById(`status-select-${orderId}`);
                const newStatus = selectElement.value;
                await updateOrderStatus(orderId, newStatus);
            });
        });

    } catch (error) {
        showMessage(`Error fetching all orders: ${error.message}`, 'error');
        console.error("Error fetching all orders:", error);
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await updateDoc(doc(db, 'orders', orderId), {
            status: newStatus
        });
        showMessage('Order status updated successfully!', 'success');
        // Update status display without full page reload
        const statusSpan = document.getElementById(`status-${orderId}`);
        if (statusSpan) {
            statusSpan.textContent = newStatus;
            statusSpan.className = `status-${newStatus.toLowerCase()}`; // Update class for styling
        }
    } catch (error) {
        showMessage(`Error updating order status: ${error.message}`, 'error');
        console.error("Error updating order status:", error);
    }
}

// Main App Flow and Event Listeners 
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await updateNavUI(user); // Ensure navigation is updated after role is fetched

    const path = window.location.pathname;

    // Redirect unauthenticated users from protected pages
    if (!user && (path.includes('user_dashboard.html') || path.includes('user_orders.html') || path.includes('admin_'))) {
        showMessage('Please login to access this page.', 'info');
        redirectTo('auth.html');
        return;
    }

    // Redirect non-admin users from admin pages
    if (user && path.includes('admin_') && currentUserRole !== 'admin') {
        showMessage('You do not have administrative access.', 'error');
        redirectTo('user_dashboard.html'); // Redirect to seller dashboard for regular users
        return;
    }

    // Page-specific initializations
    if (path.includes('auth.html')) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const showSignupBtn = document.getElementById('show-signup');
        const showLoginBtn = document.getElementById('show-login');

        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (signupForm) signupForm.addEventListener('submit', handleSignup);

        if (showSignupBtn && showLoginBtn) {
            showSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelector('.form-card:nth-child(1)').style.display = 'none';
                document.querySelector('.form-card:nth-child(2)').style.display = 'block';
            });
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelector('.form-card:nth-child(1)').style.display = 'block';
                document.querySelector('.form-card:nth-child(2)').style.display = 'none';
            });
        }
    } else if (path.includes('user_dashboard.html')) {
        if (user && currentUserRole === 'user') { // Only for 'user' role (seller)
            const addProductForm = document.getElementById('add-product-form');
            if (addProductForm) addProductForm.addEventListener('submit', addProduct);
            displaySellerProducts();
        } else if (user && currentUserRole === 'admin') {
             // Admin logged in, but landed on seller dashboard. Redirect to admin dashboard.
            redirectTo('admin_dashboard.html');
        }
    } else if (path.includes('user_orders.html')) {
        if (user) {
            displayCart();
            displayUserOrders();
            const placeOrderBtn = document.getElementById('place-order-btn');
            if (placeOrderBtn) placeOrderBtn.addEventListener('click', placeOrder);
        }
    } else if (path.includes('admin_dashboard.html')) {
        if (user && currentUserRole === 'admin') {
            displayAllProductsForAdmin();
        } else if (user && currentUserRole === 'user') {
            redirectTo('user_dashboard.html'); // Prevent non-admins from seeing this
        }
    } else if (path.includes('admin_orders.html')) {
        if (user && currentUserRole === 'admin') {
            displayAllOrders();
        } else if (user && currentUserRole === 'user') {
            redirectTo('user_dashboard.html'); // Prevent non-admins from seeing this
        }
    }

    // Logout button listener (present on all pages)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
});

// For setDoc
import { setDoc } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";