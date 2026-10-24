# ReVive

A full-stack platform for community-driven sharing, trading, and credit-based economy, built with React Native (Expo), Supabase, Clerk authentication, and Bun for backend services.

---

## 🚀 Project Overview
ReVive is a mobile-first application that enables users to:
- Sign up and log in with email/password or Google (OAuth) via Clerk
- List items (food or non-food) for sale or free
- Upload and display product images using Supabase Storage
- Manage and view orders
- Earn and transfer credits in a community economy
- Redeem credits for rewards
- Participate in a community via a sidebar and navigation

---

## 🛠️ Tech Stack
- **Frontend:** React Native (Expo), TypeScript, Tailwind CSS
- **Backend:** Bun (instead of Node.js), Express-style API
- **Database & Auth:** Supabase (Postgres, Storage, RLS)
- **Authentication:** Clerk
- **State Management:** React Context/State
- **Other:** Expo Router, Ionicons

---

## 📁 Folder Structure
```
ReVive/
  backend/           # Bun backend API (Express-style)
    credit/          # Credit transfer and transaction endpoints
    index.ts         # Bun server entry point
    ...
  frontend/          # React Native (Expo) app
    app/             # Main app screens and navigation
    components/      # Reusable UI components
    lib/             # Supabase and utility functions
    Providers/       # Clerk provider setup
    assets/          # Fonts and images
    ...
```

---

## ⚡ Getting Started

### 1. Prerequisites
- [Bun](https://bun.sh/) (for backend)
- [Node.js](https://nodejs.org/) (for Expo CLI)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Supabase](https://supabase.com/) project (with Storage, RLS, and tables set up)
- [Clerk](https://clerk.com/) project for authentication

### 2. Clone the Repository
```sh
git clone <your-repo-url>
cd ReVive
```

### 3. Backend Setup (Bun)
```sh
cd backend
bun install
bun run index.ts
```
- The backend runs on `http://localhost:3000` by default.
- Endpoints:
  - `POST /transfer` (credit transfer)
  - `GET /transactions/:userId` (fetch transactions)

### 4. Frontend Setup (Expo)
```sh
cd frontend
bun install
expo start
```
- Use Expo Go app or a custom dev client for image upload features.

### 5. Environment Variables
Create a `.env` file in both `backend/` and `frontend/` as needed:

**Backend (`backend/.env`):**
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
```

**Frontend (`frontend/.env`):**
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## ✨ Features
- **User Authentication:** Clerk (email/password, Google OAuth)
- **User Data Sync:** Clerk user data is synced to Supabase `users` table
- **Item Listing:** Add, view, and delete items (food/sale)
- **Image Upload:** Upload images to Supabase Storage (with RLS for public access)
- **Order Management:** View and delete orders
- **Credit Economy:** Transfer credits, view transactions, redeem rewards
- **Sidebar Navigation:** Profile info, orders, logout
- **Responsive UI:** Modern, mobile-first design

---

## 📝 Supabase Setup
- Create tables: `users`, `itemdata`, `credit_stack`, etc.
- Enable Row Level Security (RLS) and set policies for public access to storage buckets.
- Create a storage bucket named `item-images`.
- Example RLS policy for storage:
  - Allow public `select` and `insert` on storage objects.

---

## 🔑 Clerk Setup
- Create a Clerk project and get your publishable key.
- Configure OAuth providers (e.g., Google).
- Set allowed redirect URLs for Expo.

---

## 🐞 Troubleshooting
- **Image upload fails in Expo Go:** Use a custom dev client or base64 upload workaround.
- **RLS errors:** Double-check Supabase policies for storage and tables.
- **Module not found:** Run `bun install` in both `backend/` and `frontend/`.
- **Metro bundler issues:** Restart with `expo start -c`.

---

## 🤝 Contributing
1. Fork the repo and create your branch (`git checkout -b feature/your-feature`)
2. Commit your changes (`git commit -am 'Add new feature'`)
3. Push to the branch (`git push origin feature/your-feature`)
4. Create a Pull Request

---

## 📄 License
MIT

---

## 🙏 Acknowledgements
- [Supabase](https://supabase.com/)
- [Clerk](https://clerk.com/)
- [Bun](https://bun.sh/)
- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
