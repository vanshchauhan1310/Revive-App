import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { setupUserRoutes } from './user/index.js';

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Initialize Supabase client for credit and messaging modules
const supabaseUrl = "https://bzqqeativrabfbcqlzzl.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NTQ3ODksImV4cCI6MjA2NjIzMDc4OX0.sY1Y_g0GG2WIM36P4mMEB4toxtGC_HqOU4olWMsNxiI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Setup User Management Routes
setupUserRoutes(app);

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { clerk_user_id, name, email, photo_url, phone_number } = req.body;

    if (!clerk_user_id || !name || !email) {
      return res.status(400).json({ 
        error: 'clerk_user_id, name, and email are required' 
      });
    }

    console.log('🔍 Creating new user:', { name, email });

    // Create user in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        clerk_user_id,
        name,
        email,
        photo_url: photo_url || null,
        phone_number: phone_number || null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating user:', userError);
      return res.status(500).json({ 
        error: 'Failed to create user', 
        supabaseError: userError 
      });
    }

    // Give new user 100,000 credits by default (using system user as sender)
    const { data: creditData, error: creditError } = await supabase
      .from('credit_stack')
      .insert([{
        sender_id: userData.id, // Self-transfer for initial credits
        receiver_id: userData.id,
        amount: 100000,
        description: 'Welcome bonus - Initial credits',
        created_at: new Date().toISOString(),
      }]);

    if (creditError) {
      console.error('❌ Error giving initial credits:', creditError);
      // Don't fail user creation if credit assignment fails
    } else {
      console.log('✅ Initial credits assigned:', creditData);
    }

    console.log('✅ User created successfully:', userData);
    
    return res.status(201).json({ 
      success: true,
      user: userData,
      message: 'User created successfully with 100,000 initial credits'
    });
  } catch (error) {
    console.error('💥 Server error creating user:', error);
    return res.status(500).json({ 
      error: 'Unexpected server error' 
    });
  }
});

// Give initial credits to existing users
app.post('/api/users/:userId/give-initial-credits', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🔍 POST /api/users/:userId/give-initial-credits endpoint called');
    console.log('📊 userId:', userId);
    
    if (!userId) {
      console.log('❌ No userId provided');
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if user already has credits
    const { data: existingCredits, error: creditCheckError } = await supabase
      .from('credit_stack')
      .select('*')
      .eq('receiver_id', userId)
      .limit(1);

    if (creditCheckError) {
      console.error('❌ Error checking existing credits:', creditCheckError);
      return res.status(500).json({ error: 'Failed to check existing credits' });
    }

    if (existingCredits && existingCredits.length > 0) {
      console.log('✅ User already has credits');
      return res.status(200).json({ 
        success: true,
        message: 'User already has credits',
        existingCredits: existingCredits.length
      });
    }

    // Give user 100,000 credits using self-transfer
    const { data: creditData, error: creditError } = await supabase
      .from('credit_stack')
      .insert([{
        sender_id: userId, // Self-transfer for initial credits
        receiver_id: userId,
        amount: 100000,
        description: 'Welcome bonus - Initial credits',
        created_at: new Date().toISOString(),
      }]);

    if (creditError) {
      console.error('❌ Error giving initial credits:', creditError);
      return res.status(500).json({ error: 'Failed to give initial credits' });
    }

    console.log('✅ Initial credits given successfully:', creditData);
    
    return res.status(200).json({ 
      success: true,
      credits: creditData,
      message: 'Initial credits given successfully'
    });
  } catch (error) {
    console.error('💥 Server error giving initial credits:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Credit module routes
app.post('/api/transfer', async (req, res) => {
  try {
    const { senderId, receiverId, amount, description } = req.body;

    if (!senderId || !receiverId || senderId === receiverId || !amount) {
      return res.status(400).json({ 
        error: 'Invalid sender/receiver or amount' 
      });
    }

    const { data, error } = await supabase
      .from('credit_stack')
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        amount,
        description,
      }]);

    if (error) {
      return res.status(500).json({ 
        error: error.message 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data 
    });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message 
    });
  }
});

app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    const { data, error } = await supabase
      .from('credit_stack')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching transactions for user ${userId}:`, error);
      return res.status(500).json({ 
        error: error.message 
      });
    }

    console.log(`Transactions fetched for user ${userId}`);
    console.log(data);
    return res.status(200).json({ 
      data 
    });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message 
    });
  }
});

// GET /api/balance/:userId - Get user credit balance
app.get('/api/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    const { data, error } = await supabase
      .from('credit_stack')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
      console.error(`Error fetching balance for user ${userId}:`, error);
      return res.status(500).json({ 
        error: error.message 
      });
    }

    // Calculate balance
    const balance = (data || []).reduce((sum, tx) => {
      if (tx.receiver_id === userId) return sum + tx.amount;
      if (tx.sender_id === userId) return sum - tx.amount;
      return sum;
    }, 0);

    console.log(`Balance fetched for user ${userId}: ${balance}`);
    return res.status(200).json({ 
      balance 
    });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message 
    });
  }
});

// Messaging module routes
app.post('/api/send-message', async (req, res) => {
  try {
    const { sender_id, receiver_id, chat_id, text } = req.body;

    if (!sender_id || !receiver_id || !chat_id || !text) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id, receiver_id, chat_id, text }]);

    if (error) {
      return res.status(500).json({ 
        error: 'Insert failed', 
        supabaseError: error 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: data 
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Unexpected error occurred.' 
    });
  }
});

app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({ 
        error: 'Chat ID is required' 
      });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ 
        error: 'Fetch failed', 
        supabaseError: error 
      });
    }

    return res.status(200).json({ 
      messages: data 
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Unexpected error occurred.' 
    });
  }
});

app.get('/api/create', async (req, res) => {
res.send("Welcome to the ReVive Backend API! Use the endpoints to manage users, credits, messages, and orders.");
})

app.post('/api/create-chat', async (req, res) => {
  try {
    console.log('🔍 POST /api/create-chat endpoint called');
    console.log('📊 Request body:', JSON.stringify(req.body, null, 2));
    
    const { chat_id, sender_id, receiver_id, item_name } = req.body;
    
    console.log('📊 Extracted fields:', { chat_id, sender_id, receiver_id, item_name });

    if (!chat_id || !sender_id || !receiver_id || !item_name) {
      console.log('❌ Missing required fields');
      console.log('📊 Field check:', {
        chat_id: !!chat_id,
        sender_id: !!sender_id,
        receiver_id: !!receiver_id,
        item_name: !!item_name
      });
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    const { data, error } = await supabase
      .from('chats')
      .upsert([{
        chat_id,
        sender_id,
        receiver_id,
        item_name,
        updated_at: new Date().toISOString()
      }], { onConflict: 'chat_id' });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Insert/upsert failed', 
        supabaseError: error 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Chat created or already exists' 
    });
  } catch (error) {
    console.error('Catch error:', error);
    return res.status(500).json({ 
      error: 'Unexpected server error' 
    });
  }
});

app.get('/api/inbox/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    // Fetch chats with sender and receiver names using Supabase's select
    const { data, error } = await supabase
      .from('chats')
      .select(`*, sender:sender_id (name), receiver:receiver_id (name)`) // join users table for both sender and receiver
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ 
        error: 'Inbox fetch failed', 
        supabaseError: error 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ 
      error: 'Unexpected server error' 
    });
  }
});
app.post('/orders/new', async (req, res) => {
  try {
    const { current_user_id, item_id, owner_user_id, timestamp, status } = req.body;

    // Validate the incoming data
    if (!current_user_id || !item_id || !owner_user_id || typeof status !== 'boolean') {
      return res.status(400).json({ 
        error: 'Missing required fields for order creation' 
      });
    }

    const { data, error } = await supabase
      .from('orders') // Assumes you have a table named 'orders'
      .insert([{
        requester_id: current_user_id,
        item_id: item_id,
        owner_id: owner_user_id,
        created_at: timestamp, // Using the timestamp from the client
        status: status,
      }])
      .select(); // Return the newly created order

    if (error) {
      console.error('Supabase order insert error:', error);
      return res.status(500).json({ 
        error: 'Failed to create order', 
        supabaseError: error 
      });
    }

    // Return a 201 Created status for successful creation
    return res.status(201).json({ 
      success: true, 
      order: data[0] 
    });
    
  } catch (error) {
    console.error('Server error creating order:', error);
    return res.status(500).json({ 
      error: 'Unexpected server error' 
    });
  }
});

// GET /api/products?userId=USER_ID
app.get('/api/products', async (req, res) => {
  try {
    const { userId } = req.query;
    console.log('🔍 /api/products endpoint called');
    console.log('📊 Request query:', req.query);
    console.log('📊 userId from query:', userId);
    console.log('📊 userId type:', typeof userId);
    
    if (!userId) {
      console.log('❌ No userId provided in request');
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('🔄 Fetching products for userId:', userId);
    
    // Fetch products for the user from itemdata
    const { data, error } = await supabase
      .from('itemdata')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error fetching products:', error);
      return res.status(500).json({ error: 'Failed to fetch products', supabaseError: error });
    }

    console.log('✅ Products fetched successfully');
    console.log('📦 Number of products found:', data?.length || 0);
    console.log('📦 Products data:', data);
    
    return res.status(200).json({ products: data });
  } catch (error) {
    console.error('💥 Server error fetching products:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// PUT /api/products/:productId - Update product
app.put('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, description, category, condition, location, price } = req.body;
    
    console.log('🔍 PUT /api/products/:productId endpoint called');
    console.log('📊 productId:', productId);
    console.log('📊 Request body:', req.body);
    
    if (!productId) {
      console.log('❌ No productId provided');
      return res.status(400).json({ error: 'productId is required' });
    }

    if (!name) {
      console.log('❌ No name provided');
      return res.status(400).json({ error: 'name is required' });
    }

    console.log('🔄 Updating product with ID:', productId);
    
    // Update product in itemdata table
    const { data, error } = await supabase
      .from('itemdata')
      .update({
        name: name,
        description: description || null,
        category: category || null,
        condition: condition || null,
        location: location || null,
        price: price || null,
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error updating product:', error);
      return res.status(500).json({ error: 'Failed to update product', supabaseError: error });
    }

    console.log('✅ Product updated successfully');
    console.log('📦 Updated product data:', data);
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('💥 Server error updating product:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// DELETE /api/products/:productId - Delete product
app.delete('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    console.log('🔍 DELETE /api/products/:productId endpoint called');
    console.log('📊 productId:', productId);
    
    if (!productId) {
      console.log('❌ No productId provided');
      return res.status(400).json({ error: 'productId is required' });
    }

    console.log('🔄 Deleting product with ID:', productId);
    
    // Delete product from itemdata table
    const { data, error } = await supabase
      .from('itemdata')
      .delete()
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error deleting product:', error);
      return res.status(500).json({ error: 'Failed to delete product', supabaseError: error });
    }

    if (!data) {
      console.log('❌ Product not found');
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('✅ Product deleted successfully');
    console.log('📦 Deleted product data:', data);
    
    return res.status(200).json({ 
      message: 'Product deleted successfully',
      deletedProduct: data 
    });
  } catch (error) {
    console.error('💥 Server error deleting product:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Order Management APIs

// POST /api/orders - Create new order request
app.post('/api/orders', async (req, res) => {
  try {
    const { requester_id, item_id, owner_id, item_name, requester_name, owner_name } = req.body;
    
    console.log('🔍 POST /api/orders endpoint called');
    console.log('📊 Request body:', req.body);
    
    if (!requester_id || !item_id || !owner_id || !item_name || !requester_name || !owner_name) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('requester_id', requester_id)
      .eq('item_id', item_id)
      .eq('owner_id', owner_id)
      .single();

    if (existingOrder) {
      console.log('❌ Order already exists');
      return res.status(400).json({ error: 'Order request already exists' });
    }

    console.log('🔄 Creating new order request');
    
    // Create order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        requester_id,
        item_id,
        owner_id,
        item_name,
        requester_name,
        owner_name,
        status: 'pending', // pending, accepted, declined, delivered
        delivery_status: 'booked', // booked, rejected, delivered
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (orderError) {
      console.error('❌ Supabase error creating order:', orderError);
      return res.status(500).json({ error: 'Failed to create order', supabaseError: orderError });
    }

    // Create notification for owner
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        user_id: owner_id,
        type: 'order_request',
        title: 'New Order Request',
        message: `${requester_name} wants to get your item: ${item_name}`,
        order_id: orderData.id,
        requester_id,
        item_id,
        read: false,
        created_at: new Date().toISOString(),
      }]);

    if (notificationError) {
      console.error('❌ Supabase error creating notification:', notificationError);
      // Don't fail the order creation if notification fails
    }

    console.log('✅ Order created successfully');
    console.log('📦 Order data:', orderData);
    
    return res.status(201).json({ 
      success: true,
      order: orderData,
      message: 'Order request sent successfully'
    });
  } catch (error) {
    console.error('💥 Server error creating order:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// GET /api/orders/:userId - Get orders for a user (both as requester and owner)
app.get('/api/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🔍 GET /api/orders/:userId endpoint called');
    console.log('📊 userId:', userId);
    
    if (!userId) {
      console.log('❌ No userId provided');
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('🔄 Fetching orders for userId:', userId);
    
    // Get orders where user is requester or owner
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error fetching orders:', error);
      return res.status(500).json({ error: 'Failed to fetch orders', supabaseError: error });
    }

    console.log('✅ Orders fetched successfully');
    console.log('📦 Number of orders found:', data?.length || 0);
    
    return res.status(200).json({ orders: data });
  } catch (error) {
    console.error('💥 Server error fetching orders:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// PUT /api/orders/:orderId/respond - Accept or decline order
app.put('/api/orders/:orderId/respond', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { response, owner_id } = req.body; // response: 'accepted' or 'declined'
    
    console.log('🔍 PUT /api/orders/:orderId/respond endpoint called');
    console.log('📊 orderId:', orderId);
    console.log('📊 Request body:', req.body);
    
    if (!orderId || !response || !owner_id) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'orderId, response, and owner_id are required' });
    }

    if (!['accepted', 'declined'].includes(response)) {
      console.log('❌ Invalid response');
      return res.status(400).json({ error: 'Response must be "accepted" or "declined"' });
    }

    console.log('🔄 Updating order response');
    
    // Update order status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({ 
        status: response,
        delivery_status: response === 'accepted' ? 'booked' : 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('owner_id', owner_id) // Ensure only owner can respond
      .select()
      .single();

    if (orderError) {
      console.error('❌ Supabase error updating order:', orderError);
      return res.status(500).json({ error: 'Failed to update order', supabaseError: orderError });
    }

    if (!orderData) {
      console.log('❌ Order not found or unauthorized');
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    // Create notification for requester
    const notificationTitle = response === 'accepted' ? 'Order Accepted!' : 'Order Declined';
    const notificationMessage = response === 'accepted' 
      ? `Your request for "${orderData.item_name}" has been accepted!`
      : `Your request for "${orderData.item_name}" has been declined.`;

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        user_id: orderData.requester_id,
        type: 'order_response',
        title: notificationTitle,
        message: notificationMessage,
        order_id: orderId,
        read: false,
        created_at: new Date().toISOString(),
      }]);

    if (notificationError) {
      console.error('❌ Supabase error creating notification:', notificationError);
      // Don't fail the order update if notification fails
    }

    console.log('✅ Order response updated successfully');
    console.log('📦 Updated order data:', orderData);
    
    return res.status(200).json({ 
      success: true,
      order: orderData,
      message: `Order ${response} successfully`
    });
  } catch (error) {
    console.error('💥 Server error updating order:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});


// GET /api/bills - Get bill by order ID
app.get('/api/bills', async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id query parameter is required' });
    }

    // Fetch bill with order details
    const { data: bill, error } = await supabase
      .from('bills')
      .select(`
        *,
        order:orders(
          id,
          item_name,
          requester_name,
          owner_name,
          status,
          delivery_status
        )
      `)
      .eq('order_id', order_id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Database error', details: error });
    }

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found for this order' });
    }

    return res.status(200).json({
      success: true,
      bills: [bill] // Return as array to match your frontend expectation
    });

  } catch (error) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// PUT /api/orders/:orderId/deliver - Mark order as delivered and generate OTP
app.post('/api/orders/:orderId/deliver', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { owner_id } = req.body;
    
    if (!orderId || !owner_id) {
      return res.status(400).json({ error: 'orderId and owner_id are required' });
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // First, check if the order exists and is in the correct state
    const { data: existingOrder, error: checkError } = await supabase
      .from('orders')
      .select('*, itemdata!inner(*)')
      .eq('id', orderId)
      .eq('owner_id', owner_id)
      .eq('status', 'accepted')
      .single();

    if (checkError || !existingOrder) {
      return res.status(404).json({ error: 'Order not found or not in correct state for delivery' });
    }


    // Calculate bill amounts
    const productPrice = parseFloat(existingOrder.itemdata.price) || 0;
    const platformFee = productPrice * 0.02; // 2% platform fee
    const totalAmount = productPrice + platformFee;

    // Generate bill ID
    const billId = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create bill record
    const { error: billError } = await supabase
      .from('bills')
      .insert([{
        bill_id: billId,
        order_id: orderId,
        requester_id: existingOrder.requester_id,
        amount: productPrice,
        platform_fee: platformFee,
        total_amount: totalAmount,
        status: 'pending',
        created_at: new Date().toISOString(),
      }]);

    if (billError) {
      return res.status(500).json({ error: 'Failed to generate bill', supabaseError: billError });
    }

    // Update order status and add OTP
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({ 
        status: 'accepted',
        delivery_status: 'inprogress',
        delivery_otp: otp,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('owner_id', owner_id)
      .select()
      .single();

    if (orderError) {
      console.log(orderError)
      return res.status(500).json({ error: 'Failed to update order', supabaseError: orderError });
    }

    // Create notification for requester (receiver) with OTP
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        user_id: existingOrder.requester_id,
        type: 'delivery_otp',
        title: 'OTP Generated',
        message: `OTP: ${otp}. Please verify with seller and pay the bill.`,
        order_id: orderId,
        delivery_otp: otp,
        read: false,
        created_at: new Date().toISOString(),
      }]);

    return res.status(200).json({ 
      success: true,
      order: orderData,
      message: 'Order marked as delivered and OTP sent to receiver'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});


// POST /api/orders/:orderId/generate-bill - Generate bill for delivery
app.post('/api/orders/:orderId/generate-bill', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { requester_id } = req.body;
    
    console.log('🔍 POST /api/orders/:orderId/generate-bill endpoint called');
    console.log('📊 orderId:', orderId);
    console.log('📊 Request body:', req.body);
    
    if (!orderId || !requester_id) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'orderId and requester_id are required' });
    }

    // Check if bill already exists for this order
    const { data: existingBill, error: existingBillError } = await supabase
      .from('bills')
      .select('*')
      .eq('order_id', orderId)
      .eq('requester_id', requester_id)
      .single();

    if (existingBill && !existingBillError) {
      console.log('📋 Bill already exists for this order');
      return res.status(200).json({ 
        success: true,
        bill: existingBill,
        breakdown: {
          productPrice: parseFloat(existingBill.amount),
          platformFee: parseFloat(existingBill.platform_fee),
          totalAmount: parseFloat(existingBill.total_amount)
        },
        message: 'Bill already exists for this order'
      });
    }

    // Get the order and product details to calculate proper amount
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, itemdata!inner(*)')
      .eq('id', orderId)
      .eq('requester_id', requester_id)
      .single();

    if (orderError || !orderData) {
      console.error('❌ Order not found:', orderError);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate bill amounts
    const productPrice = parseFloat(orderData.itemdata.price) || 0;
    const platformFee = productPrice * 0.02; // 2% platform fee
    const totalAmount = productPrice + platformFee;

    console.log('💰 Bill calculation:', {
      productPrice,
      platformFee,
      totalAmount
    });

    // Generate bill ID
    const billId = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔄 Generating bill for order');
    
    // Create bill record
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert([{
        bill_id: billId,
        order_id: orderId,
        requester_id,
        amount: productPrice,
        platform_fee: platformFee,
        total_amount: totalAmount,
        status: 'pending', // pending, paid, cancelled
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (billError) {
      console.error('❌ Supabase error creating bill:', billError);
      return res.status(500).json({ error: 'Failed to generate bill', supabaseError: billError });
    }

    // Create notification for requester
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        user_id: requester_id,
        type: 'bill_generated',
        title: 'Bill Generated',
        message: `Bill generated for "${orderData.item_name}". Product: ${productPrice} credits, Platform Fee: ${platformFee} credits, Total: ${totalAmount} credits.`,
        order_id: orderId,
        bill_id: billId,
        read: false,
        created_at: new Date().toISOString(),
      }]);

    if (notificationError) {
      console.error('❌ Supabase error creating notification:', notificationError);
    }

    console.log('✅ Bill generated successfully');
    console.log('📦 Bill data:', billData);
    
    return res.status(201).json({ 
      success: true,
      bill: billData,
      breakdown: {
        productPrice,
        platformFee,
        totalAmount
      },
      message: 'Bill generated successfully'
    });
  } catch (error) {
    console.error('💥 Server error generating bill:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// POST /api/orders/:orderId/pay-bill - Pay bill and transfer credits
app.post('/api/orders/:orderId/pay-bill', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { requester_id, owner_id } = req.body;
    
    console.log('🔍 POST /api/orders/:orderId/pay-bill endpoint called');
    console.log('📊 orderId:', orderId);
    console.log('📊 Request body:', req.body);
    
    if (!orderId || !requester_id || !owner_id) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'orderId, requester_id, and owner_id are required' });
    }

    console.log('🔄 Step 1: Verifying bill exists');
    // 1. Verify the bill exists and is payable
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*')
      .eq('order_id', orderId)
      .eq('requester_id', requester_id)
      .single();

    if (billError) {
      console.error('❌ Bill fetch error:', billError);
      return res.status(404).json({ error: 'Bill not found', details: billError });
    }
    if (!bill) {
      console.log('❌ No bill found');
      return res.status(404).json({ error: 'Bill not found' });
    }
    if (bill.status === 'paid') {
      console.log('❌ Bill already paid');
      return res.status(400).json({ error: 'Bill already paid' });
    }

    console.log('✅ Bill found:', bill);
    console.log('💰 Bill details - Product:', bill.amount, 'Platform Fee:', bill.platform_fee, 'Total:', bill.total_amount);

    console.log('🔄 Step 2: Checking buyer balance');
    // 2. Check if buyer has sufficient credits
    const { data: buyerTransactions, error: buyerError } = await supabase
      .from('credit_stack')
      .select('*')
      .or(`sender_id.eq.${requester_id},receiver_id.eq.${requester_id}`);

    if (buyerError) {
      console.error('❌ Buyer balance check error:', buyerError);
      return res.status(500).json({ error: 'Failed to check buyer balance', details: buyerError });
    }

    console.log(`📊 Found ${buyerTransactions?.length || 0} transactions for buyer ${requester_id}`);
    
    // Calculate buyer's balance
    const buyerBalance = (buyerTransactions || []).reduce((sum, tx) => {
      if (tx.receiver_id === requester_id) {
        console.log(`➕ Credit IN: ${tx.amount} (${tx.description || 'No description'})`);
        return sum + tx.amount;
      }
      if (tx.sender_id === requester_id) {
        console.log(`➖ Credit OUT: ${tx.amount} (${tx.description || 'No description'})`);
        return sum - tx.amount;
      }
      return sum;
    }, 0);

    console.log(`💰 Buyer balance: ${buyerBalance}, Required: ${bill.total_amount}`);
    
    if (buyerBalance < bill.total_amount) {
      console.log('❌ Insufficient balance');
      return res.status(400).json({ 
        error: 'Insufficient credits for payment',
        balance: buyerBalance,
        required: bill.total_amount
      });
    }

    // Get order details for item name
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('item_name')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error('❌ Order not found for item name:', orderError);
      return res.status(500).json({ error: 'Order not found' });
    }

    const itemName = orderData.item_name;
    console.log(`📦 Item name: ${itemName}`);

    console.log('🔄 Step 3: Processing payment transactions');
    // 3a. Debit total amount from buyer (including platform fee)
    const { error: buyerDebitError } = await supabase
      .from('credit_stack')
      .insert({
        sender_id: requester_id, // From buyer (shows as debit)
        receiver_id: 'platform', // To platform (to show proper debit)
        amount: bill.total_amount, // Positive amount (will show as red/debit because user is sender)
        description: `Payment for "${itemName}" - Total ${bill.total_amount} credits deducted (Product: ${bill.amount}, Platform fee: ${bill.platform_fee})`,
        created_at: new Date().toISOString()
      });

    if (buyerDebitError) {
      console.error('❌ Buyer debit transaction error:', buyerDebitError);
      return res.status(500).json({ error: 'Buyer debit transaction failed', details: buyerDebitError });
    }
    console.log(`✅ Buyer debit successful: ${bill.total_amount} credits deducted from buyer ${requester_id}`);

    // 3b. Credit only product price to seller
    const { error: sellerCreditError } = await supabase
      .from('credit_stack')
      .insert({
        sender_id: 'platform', // Platform as sender (can use a system ID)
        receiver_id: owner_id, // To seller
        amount: bill.amount, // Only product price to seller
        description: `Payment received for "${itemName}" - ${bill.amount} credits (from total payment of ${bill.total_amount})`,
        created_at: new Date().toISOString()
      });

    if (sellerCreditError) {
      console.error('❌ Seller credit transaction error:', sellerCreditError);
      return res.status(500).json({ error: 'Seller credit transaction failed', details: sellerCreditError });
    }
    console.log(`✅ Payment transactions successful: ${bill.total_amount} debited from buyer, ${bill.amount} credited to seller, ${bill.platform_fee} platform fee retained`);

    console.log('🔄 Step 5: Updating bill status to paid');
    console.log('🔄 Step 6: Updating order status to delivered');
    console.log('🔄 Step 7: Creating payment notification');

    // 3. Update bill status
    const { data: updatedBill, error: billUpdateError } = await supabase
      .from('bills')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString() 
      })
      .eq('id', bill.id)
      .select()
      .single();

    if (billUpdateError) {
      return res.status(500).json({ error: 'Failed to update bill' });
    }

    // 4. Update order status
    const { data: updatedOrder, error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivery_status: 'delivered',
        completed_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (orderUpdateError) {
      return res.status(500).json({ error: 'Failed to update order' });
    }

    // 5. Create notification
    await supabase
      .from('notifications')
      .insert({
        user_id: owner_id,
        type: 'payment_received',
        title: 'Payment Received',
message: `Received ${bill.amount} credits for "${itemName}". Total paid: ${bill.total_amount} credits (including ${bill.platform_fee} platform fee)`,
        order_id: orderId
      });

    return res.status(200).json({ 
      success: true,
      order: updatedOrder,
      bill: updatedBill,
      message: 'Payment processed successfully'
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/orders/:orderId/verify-otp - Verify OTP for delivery completion
app.post('/api/orders/:orderId/verify-otp', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp, owner_id } = req.body;
    
    if (!orderId || !otp || !owner_id) {
      return res.status(400).json({ error: 'orderId, otp, and owner_id are required' });
    }

    // Get order and verify OTP
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('owner_id', owner_id)
      .eq('delivery_otp', otp)
      .single();

    if (orderError || !orderData) {
      console.log(orderError)
      return res.status(400).json({ error: 'Invalid OTP or order not found' });
    }

    // Mark OTP as verified but don't complete order yet
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ 
        delivery_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update order', supabaseError: updateError });
    }

    return res.status(200).json({ 
      success: true,
      order: updatedOrder,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});


// GET /api/notifications/:userId - Get notifications for a user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🔍 GET /api/notifications/:userId endpoint called');
    console.log('📊 userId:', userId);
    
    if (!userId) {
      console.log('❌ No userId provided');
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('🔄 Fetching notifications for userId:', userId);
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications', supabaseError: error });
    }

    console.log('✅ Notifications fetched successfully');
    console.log('📦 Number of notifications found:', data?.length || 0);
    
    return res.status(200).json({ notifications: data });
  } catch (error) {
    console.error('💥 Server error fetching notifications:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// PUT /api/notifications/:notificationId/read - Mark notification as read
app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    console.log('🔍 PUT /api/notifications/:notificationId/read endpoint called');
    console.log('📊 notificationId:', notificationId);
    
    if (!notificationId) {
      console.log('❌ No notificationId provided');
      return res.status(400).json({ error: 'notificationId is required' });
    }

    console.log('🔄 Marking notification as read');
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error updating notification:', error);
      return res.status(500).json({ error: 'Failed to update notification', supabaseError: error });
    }

    console.log('✅ Notification marked as read');
    
    return res.status(200).json({ 
      success: true,
      notification: data
    });
  } catch (error) {
    console.error('💥 Server error updating notification:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'ReVive Backend Server is running',
    modules: ['User Management', 'Credit System', 'Messaging', 'Orders']
  });
});

// Supabase connectivity test endpoint
app.get('/api/test-supabase', async (req, res) => {
  try {
    console.log('🔍 Testing Supabase connectivity from API endpoint...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Supabase connection failed',
        details: {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        }
      });
    }
    
    console.log('✅ Supabase connection successful!');
    return res.status(200).json({
      success: true,
      message: 'Supabase connection successful',
      data: data
    });
    
  } catch (error) {
    console.error('💥 Unexpected error during Supabase test:', error);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error',
      details: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
  }
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.status(200).json({ 
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /api/products?userId=USER_ID',
      'PUT /api/products/:productId',
      'GET /api/test'
    ]
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST; // Use new IP as default
app.listen(PORT, HOST, () => {
  console.log("🚀 ReVive Backend Server running on http://" + HOST + ":" + PORT);
  console.log("📋 Available modules:");
  console.log("   👤 User Management: /api/users");
  console.log("   💰 Credit System: /api/transfer, /api/transactions/:userId");
  console.log("   💬 Messaging: /api/send-message, /api/messages/:chatId, /api/create-chat, /api/inbox/:userId");
  console.log("   🛒 Orders: /api/orders/new");
  console.log("   📦 Products: /api/products, /api/products/:productId");
  console.log("   🏥 Health Check: /health");
  console.log("   🧪 Test: /api/test");
});