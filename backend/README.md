# ReVive Backend

Modular backend server for the ReVive app that handles user management, credit system, and messaging operations.

## 🏗️ Architecture

The backend is organized into modular components:

```
backend/
├── index.ts          # Main server entry point
├── user/             # User management module
│   └── index.ts      # User CRUD operations
├── credit/           # Credit system module (existing)
│   └── index.js      # Credit transfer operations
└── messaging/        # Messaging module (existing)
    └── index.js      # Chat and message operations
```

## 🚀 Setup

1. Install dependencies:
```bash
bun install
```

2. Set up environment variables:
Create a `.env` file in the backend directory with:
```
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. Run the server:
```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

## 📋 API Endpoints

### 👤 User Management (`/api/users`)

**POST** - Create a new user
```json
{
  "clerk_user_id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "photo_url": "https://example.com/photo.jpg",
  "phone_number": "+1234567890"
}
```

**GET** - Get all users or specific user
- `/api/users` - Get all users
- `/api/users?clerk_user_id=user_123` - Get specific user

**PUT** - Update user
- `/api/users?clerk_user_id=user_123` with body

**DELETE** - Delete user
- `/api/users?clerk_user_id=user_123`

### 💰 Credit System

**POST** `/api/transfer` - Transfer credits
```json
{
  "senderId": "user_123",
  "receiverId": "user_456",
  "amount": 100,
  "description": "Payment for item"
}
```

**GET** `/api/transactions/:userId` - Get user transactions

### 💬 Messaging System

**POST** `/api/send-message` - Send a message
```json
{
  "sender_id": "user_123",
  "receiver_id": "user_456",
  "chat_id": "chat_789",
  "text": "Hello!"
}
```

**GET** `/api/messages/:chatId` - Get chat messages

**POST** `/api/create-chat` - Create a new chat
```json
{
  "chat_id": "chat_789",
  "sender_id": "user_123",
  "receiver_id": "user_456",
  "item_name": "iPhone 12",
  "receiver_name": "John Doe"
}
```

**GET** `/api/inbox/:userId` - Get user's inbox

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  photo_url text NULL,
  phone_number text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_clerk_user_id_unique UNIQUE (clerk_user_id)
);
```

### Credit Stack Table
```sql
CREATE TABLE public.credit_stack (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  amount integer NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### Messages Table
```sql
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  chat_id text NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### Chats Table
```sql
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text NOT NULL UNIQUE,
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  item_name text NOT NULL,
  receiver_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);
```

## 🔧 Technology Stack

- **Runtime**: Bun (following cursor rules)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk integration
- **Architecture**: Modular design with separate concerns

## 🚀 Server Information

- **Port**: 3001
- **URL**: http://localhost:3001
- **Hot Reload**: Enabled in development
- **Modules**: User Management, Credit System, Messaging
