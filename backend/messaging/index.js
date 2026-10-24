import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Supabase setup
const supabase = createClient(
  'https://bzqqeativrabfbcqlzzl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NTQ3ODksImV4cCI6MjA2NjIzMDc4OX0.sY1Y_g0GG2WIM36P4mMEB4toxtGC_HqOU4olWMsNxiI'
);

// 📥 POST /send-message
app.post('/send-message', async (req, res) => {
  const { sender_id, receiver_id, chat_id, text } = req.body;

  if (!sender_id || !receiver_id || !chat_id || !text) {
    return res.status(400).json({ error: 'Missing required fields'});
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id, receiver_id, chat_id, text }]);

    if (error) {
      return res.status(500).json({ error: 'Insert failed', supabaseError: error });
    }

    return res.status(200).json({ success: true, message: data });
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected error occurred.' });
  }
});

// 📤 GET /messages/:chatId
app.get('/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Fetch failed', supabaseError: error });
    }

    return res.status(200).json({ messages: data });
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected error occurred.' });
  }
});

// 📩 POST /create-chat
app.post('/create-chat', async (req, res) => {
  const { chat_id, sender_id, receiver_id, item_name, receiver_name } = req.body;

  if (!chat_id || !sender_id || !receiver_id || !item_name || !receiver_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .upsert(
        [{
          chat_id,
          sender_id,
          receiver_id,
          item_name,
          receiver_name,
          updated_at: new Date().toISOString()
        }],
        { onConflict: ['chat_id'] }
      );

    if (error) {
      console.error('Supabase error:', error); // ⬅️ add this
      return res.status(500).json({ error: 'Insert/upsert failed', supabaseError: error });
    }

    return res.status(200).json({ success: true, message: 'Chat created or already exists' });
  } catch (err) {
    console.error('Catch error:', err); // ⬅️ and this
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});


// 📬 GET /inbox/:userId
app.get('/inbox/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Inbox fetch failed', supabaseError: error });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// 🟢 Start server
const PORT = 3001;
app.listen(PORT, () =>
  console.log(`🚀 Messaging API running on http://localhost:${PORT}`)
);
