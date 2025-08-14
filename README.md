Catering Reservation and Ordering System

## Overview
The **Catering Hub** is a web-based platform designed to connect catering service providers with customers.  
It offers a **user dashboard** for sellers to list catering services, an **admin dashboard** to manage services and orders,  
and a **customer interface** for browsing and placing orders.

The project is built using **HTML, CSS, JavaScript** with **Firebase** for authentication, database, and hosting.

## Features
- **User Authentication** with Firebase (Login, Registration, Logout)
- **Role-based Access** for Admins and Users
- **Admin Dashboard** to view and manage orders
- **User Dashboard** to upload and manage catering services
- **Real-time Database** updates using Firestore
- **Responsive Design** for mobile and desktop
- **Custom 404 Page** for error handling

## Project Structure
public/
│
├── index.html # Home page
├── auth.html # Login and registration
├── admin_dashboard.html # Admin dashboard
├── admin_orders.html # Admin order management
├── user_dashboard.html # Seller dashboard
├── user_orders.html # User order history
├── 404.html # Error page
├── style.css # Stylesheet
├── script.js # Main JavaScript logic
├── logo.png # Website logo
└── biryani.jpeg # Sample image

## Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript
- **Backend / Hosting**: Firebase  
  - Firebase Authentication  
  - Firebase Firestore Database  
  - Firebase Hosting  

## Installation & Setup
Step 1: Install Firebase CLI (if not already installed):
npm install -g firebase-tools

Step 2: Login to Firebase:
firebase login

Step 3: Initialize Firebase in the project:
firebase init

Step 4: Deploy the project:
firebase deploy

## Usage
Open index.html to view the home page.
Use auth.html to register or log in.
Admin users can access admin_dashboard.html and admin_orders.html.
Regular users can access user_dashboard.html and user_orders.html.

## Author
Roshan Singh
