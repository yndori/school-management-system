# Student Management System

A web-based **Student Management System (SMS)** built with **HTML, CSS, Node.js, Express, and MySQL**.
This project is designed for **academic use** and **team collaboration**, with a clear separation between frontend, backend, and database layers.

---

## Project Goals

The goal of this project is to build a system that allows:

- Secure authentication for **Admins** and **Students**
- Management of **courses**, **students**, and **assignments**
- Assignment and viewing of **grades**
- Viewing **schedules per major**
- Generating and printing **student transcripts**

This repository is structured to be **easy to understand**, **easy to extend**, and **safe for collaboration**.

---

## Tech Stack

### Frontend

- HTML
- CSS
- JavaScript

### Backend

- Node.js
- Express.js
- JSON Web Tokens (JWT)
- bcrypt (password hashing)

### Database

- MySQL

---

## Project Structure

```
student-management-system/
│
├── backend/            # Node.js + Express API
│   ├── src/
│   │   ├── config/     # DB connection
│   │   ├── controllers/# Business logic
│   │   ├── routes/     # API routes
│   │   ├── middleware/ # Auth & role checks
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── frontend/           # HTML/CSS/JS frontend
│   ├── pages/
│   ├── css/
│   ├── js/
│   ├── public/
│   └── index.html
│
├── database/           # MySQL scripts
│   ├── schema.sql
│   ├── seed.sql
│   └── README.md
│
├── .gitignore
└── README.md
```

---

## Authentication & Roles

The system supports two roles:

- **Admin**
  - Manage students
  - Manage courses
  - Add assignments
  - Assign grades
  - Update schedules

- **Student**
  - View enrolled courses
  - View assignments & grades
  - View schedule
  - View and print transcript

Authentication is handled using **JWT (JSON Web Tokens)**.

---

## Database

All database-related files are located in the `database/` folder.

- `schema.sql` → database structure (tables, relations)
- `seed.sql` → test data (admin, sample students, courses)

### Local setup

```bash
mysql -u root -p
CREATE DATABASE school_management;
USE school_management;
SOURCE database/schema.sql;
SOURCE database/seed.sql;
```

---

## Backend Setup (Local)

```bash
cd backend
npm install
```

Create a `backend/.env` file:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=school_management
DB_PORT=3306
JWT_SECRET=your_secret_key
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
PORT=5501
```

Start the server:

```bash
npm run seed:admin
npm run dev
```

## Frontend API Configuration

The frontend reads the API base URL from local storage key `apiBaseUrl`.
If not set, it defaults to:

```
http://<current-host>:5501/api
```

To override manually in the browser console:

```js
localStorage.setItem("apiBaseUrl", "http://localhost:5501/api");
```

To reset to default behavior:

```js
localStorage.removeItem("apiBaseUrl");
```

## Docker Setup (Recommended for Team)

Create a local Docker env file (do not commit secrets):

```bash
cp .env.docker.example .env
```

Then edit `.env` and set secure values for:

- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Run all services (MySQL + backend API + frontend static server):

```bash
docker compose up --build
```

Service URLs:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5501/api`
- Health check: `http://localhost:5501/api/health`

Stop services:

```bash
docker compose down
```

---

## Collaboration Rules

To keep the project clean and avoid conflicts:

- No direct push to `main`
- One feature per branch
- Pull before pushing

### Branch naming examples:

- `feature/auth-system`
- `feature/courses-crud`
- `feature/grades`

---

## Development Status

- [x] Database schema
- [x] Authentication system
- [ ] Admin dashboard
- [ ] Student dashboard
- [ ] Grades & transcript
- [ ] Schedule management

_(This section will be updated as the project progresses.)_

---

## Notes for Contributors

- Keep code **simple and readable**
- Comment complex logic
- Follow the existing folder structure
- Ask before making breaking changes

---

This README is **meant to evolve** — feel free to improve it as the project grows.
