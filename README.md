# 🚗 VALEO - Intelligent Camera System (AI Vision Control)

Welcome to the **Valeo Intelligent Camera System**, an AI-powered industrial vision control application built with Node.js, Express, SQLite, and Python Roboflow AI inference.

---

## 📋 Table of Contents
1. [Prerequisites (What to Install First)](#-1-prerequisites-what-to-install-first)
2. [Installation & Terminal Commands](#-2-installation--terminal-commands)
3. [How to Login & Access the Dashboard](#-3-how-to-login--access-the-dashboard)
4. [Application Navigation Routes](#-4-application-navigation-routes)
5. [Troubleshooting & FAQs](#-5-troubleshooting--faqs)

---

## 🛠️ 1. Prerequisites (What to Install First)

Before running the application, make sure your computer has the following tools installed:

| Software | Required Version | Download Link / Notes |
| :--- | :--- | :--- |
| **Node.js** | v16.0 or higher | [Download Node.js](https://nodejs.org/) (Includes `npm`) |
| **Python** | v3.8 or higher | [Download Python](https://www.python.org/) *(Ensure "Add Python to PATH" is checked during installation)* |
| **Web Browser** | Any modern browser | Google Chrome, Microsoft Edge, Mozilla Firefox, or Brave |

---

## 💻 2. Installation & Terminal Commands

You can start the application using either the **Automated Script** (Recommended) or by running **Manual Terminal Commands**.

### Option A: Automated Script (Recommended 🚀)

#### On Windows:
1. Open **Command Prompt** (cmd) or **PowerShell**.
2. Navigate to the project folder:
   ```cmd
   cd C:\Users\Lenovo\Downloads\PROJET-STAGE--main\PROJET-STAGE--main
   ```
3. Run the startup script:
   ```cmd
   start.bat
   ```
   *The script automatically verifies Node.js, installs `npm` dependencies, creates the Python virtual environment (`.venv`), installs `inference-sdk`, and starts the server at `http://localhost:3000`.*

#### On Linux / macOS:
1. Open the terminal and navigate to the project directory:
   ```bash
   cd PROJET-STAGE--main
   ```
2. Grant execution permissions and run the script:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

---

### Option B: Manual Setup via Terminal Commands

If you prefer to execute commands manually step-by-step:

#### 1️⃣ Open Terminal & Navigate to Server Directory
Make sure you are inside the `server` directory where `server.js` and `package.json` are located:
```bash
cd PROJET-STAGE--main/server
```
*(If you are already inside `PROJET-STAGE--main`, simply run `cd server`)*

#### 2️⃣ Install Node.js Dependencies
```bash
npm install
```

#### 3️⃣ Set Up Python Virtual Environment & Roboflow SDK

- **Windows (Command Prompt / PowerShell):**
  ```cmd
  python -m venv ..\.venv
  ..\.venv\Scripts\python.exe -m pip install --upgrade pip
  ..\.venv\Scripts\pip install -U inference-sdk
  ```

- **Windows (Git Bash):**
  ```bash
  python -m venv ../.venv
  ../.venv/Scripts/pip install -U inference-sdk
  ```

- **Linux / macOS:**
  ```bash
  python3 -m venv ../.venv
  source ../.venv/bin/activate
  pip install --upgrade pip
  pip install -U inference-sdk
  ```

#### 4️⃣ Launch the Application Server
Run from the `server` directory:
```bash
node server.js
```

You should see an output indicating the server is active:
```text
======================================================
              STARTING VALEO SERVER
======================================================
  URL          : http://localhost:3000
  Access       : Login required (code + password)
  Roboflow AI  : Connected
======================================================
```

---

## 🔑 3. How to Login & Access the Dashboard

### Step 1: Open Your Browser
Once the server is running, open your browser and go to:
👉 **[http://localhost:3000](http://localhost:3000)** (or `http://localhost:3000/login.html`)

---

### Step 2: Login Options

#### 👑 Option 1: Use Default Administrator Credentials
The system comes pre-configured with a default **Administrator** account:

* **Login Code / Code de connexion:** `ADMIN-001`
* **Password / Mot de passe:** `admin123`

1. Type `ADMIN-001` in the **Code de connexion** field.
2. Type `admin123` in the **Mot de passe** field.
3. Click **Se connecter**.

---

#### 👤 Option 2: Create a New User Account (Signup)
1. On the login page, click on **"S'inscrire"** or go directly to:
   👉 `http://localhost:3000/signup.html`
2. Fill out the required information:
   * **Prénom (First Name)**
   * **Nom (Last Name)**
   * **Email**
   * **Rôle (Role):** Select *Ingénieur*, *Technicien*, or *Ouvrier*
   * **Mot de passe (Password):** At least 8 characters
3. Click **Créer mon compte**.
4. ⚠️ **IMPORTANT:** A unique **Login Code** will be generated (e.g., `VAL-X7K9P2`). **Copy or write down this code!**
5. Return to `login.html`, enter your generated code (e.g., `VAL-X7K9P2`) and your password to sign in.

---

### Step 3: Enter the Dashboard
Upon successful login, you will automatically be redirected to the **Dashboard**:
👉 **[http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)**

---

## 🧭 4. Application Navigation Routes

Once logged in, you can navigate between pages using the top sidebar/navigation menu:

| Page | URL Path | Description |
| :--- | :--- | :--- |
| 📊 **Dashboard** | `/dashboard.html` | Overview of system metrics, production data, and quick actions |
| 📹 **Live Vision** | `/live.html` | Real-time camera feed and Roboflow AI detection |
| 📜 **Historique** | `/historique.html` | Inspection logs, detection history, and filter tools |
| ⚙️ **Settings** | `/settings.html` | User profile updates and password configuration |
| 👑 **Admin Panel** | `/admin.html` | User management (view accounts, modify roles, delete accounts) |

---

## ❓ 5. Troubleshooting & FAQs

- **Port 3000 is already in use:**
  If port 3000 is occupied, the `start.bat` script will automatically terminate the process using port 3000 before starting. Alternatively, close any running Node processes or restart your terminal.
- **Python / AI Detection Error:**
  Ensure Python is added to your system PATH and that the `.venv` directory contains the `inference-sdk` package.
- **Forgot Login Code:**
  If logged in as Admin (`ADMIN-001`), you can view all registered user codes in the **Admin Panel** (`admin.html`) or inspect `server/comptes_valeo.xlsx`.

---
*Created for Valeo Industrial AI Camera System Project.*
