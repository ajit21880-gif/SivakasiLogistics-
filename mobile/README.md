# Sivakasi Logistics Mobile App (Flutter)

This directory contains the Flutter Android application that serves as the offline-first mobile client for the Sivakasi Logistics & Goods Dispatch Memo (GDM) Management System.

## Features

1. **Multi-Role Portal access**:
   - **Admin**: Configure consignors, consignees, lorry fleets, enter dispatches (GDMs), view delivery status, and audits.
   - **Staff**: Log in with Staff ID to register master records and enter new dispatches. Every record tracked with audit trail of last changes.
   - **Customer**: Log in with Customer ID/Phone to track dispatches, inspect truck driver details, and contact transport owner.
2. **Offline-First Storage**:
   - Uses local SQLite cache (`sqflite`) for seamless offline operation.
   - Data can be registered locally and will sync when a network connection to the server is established.
3. **Synchronizer Engine**:
   - Synchronizes local entries, downloads master registry data (Consignors, Consignees, Lorries) from the backend.
4. **Editable Server Endpoint**:
   - Enter your backend LAN IP on the login page (e.g. `192.168.1.100:5000`) so that local testing on physical Wi-Fi devices is straightforward.

---

## Prerequisites

1. **Flutter SDK**: Install the Flutter SDK (>= 3.0.0). Run `flutter --version` to verify.
2. **Android SDK & Device**:
   - Android Studio installed with Android SDK.
   - A physical Android phone in Developer Mode with USB debugging enabled, or an Android emulator.

---

## Getting Started

1. **Navigate to the Mobile Folder**:
   ```bash
   cd c:\Ajit\Work\Website\SivakasiLogistics\mobile
   ```

2. **Retrieve Dependencies**:
   ```bash
   flutter pub get
   ```

3. **Verify the Project Setup**:
   Ensure that the linting and configuration are error-free:
   ```bash
   flutter analyze
   ```

---

## Running and Building the App

### 1. Run locally in Debug mode
To run the app on a connected device/emulator:
```bash
flutter run
```

### 2. Build Release APK for Installation
To generate an APK file that can be copied and installed on any Android phone:
```bash
flutter build apk --release
```
The compiled APK will be saved at:
`build/app/outputs/flutter-apk/app-release.apk`

---

## Connecting to the Server
When launching the app:
1. Ensure the backend server is running (e.g., at port `5000`).
2. Verify that your computer and the mobile device are connected to the **same Wi-Fi/LAN network**.
3. Determine your computer's local IP address (run `ipconfig` on Windows CMD).
4. On the login screen of the Sivakasi Logistics app, enter this IP and port (e.g., `192.168.x.x:5000`) in the **Server IP** input field before logging in.
5. Log in with the pre-seeded credentials:
   - **Admin**: ID `ADM01`, Password `Demo@123456`
   - **Staff**: ID `STF01`, Password `Demo@123456`
   - **Customer**: ID `CST01`, Password `Demo@123456`
