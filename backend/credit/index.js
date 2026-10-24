import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const supabase = createClient("https://bzqqeativrabfbcqlzzl.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NTQ3ODksImV4cCI6MjA2NjIzMDc4OX0.sY1Y_g0GG2WIM36P4mMEB4toxtGC_HqOU4olWMsNxiI");

app.get('/' , (req,res)=>{
  res.send("hello")
})


// ─────────────── POST /transfer ───────────────
app.post('/transfer', async (req, res) => {
  const { senderId, receiverId, amount, description } = req.body;

  if (!senderId || !receiverId || senderId === receiverId || !amount) {
    return res.status(400).json({ error: 'Invalid sender/receiver or amount' });
  }

  const { data, error } = await supabase
    .from('credit_stack')
    .insert([
      {
        sender_id: senderId,
        receiver_id: receiverId,
        amount,
        description,
      },
    ]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, data });
});

// ─────────────── GET /transactions/:userId ───────────────
app.get('/transactions/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('credit_stack')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching transactions for user ${userId}:`, error);
    return res.status(500).json({ error: error.message });
}

console.log(`Transactions fetched for user ${userId}`);
console.log(data);
return res.status(200).json({ data });
});

// ─────────────── GET /balance/:userId ───────────────
app.get('/balance/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('credit_stack')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) {
    console.error(`Error fetching balance for user ${userId}:`, error);
    return res.status(500).json({ error: error.message });
  }

  // Calculate balance
  const balance = (data || []).reduce((sum, tx) => {
    if (tx.receiver_id === userId) return sum + tx.amount;
    if (tx.sender_id === userId) return sum - tx.amount;
    return sum;
  }, 0);

  console.log(`Balance fetched for user ${userId}: ${balance}`);
  return res.status(200).json({ balance });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 API running on http://192.168.29.61:${PORT}`));
