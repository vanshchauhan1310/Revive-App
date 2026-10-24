import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with the same configuration as your main server
const supabaseUrl = "https://bzqqeativrabfbcqlzzl.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDY1NDc4OSwiZXhwIjoyMDY2MjMwNzg5fQ.Jdr_lvPNntZW0j6Xpgjnig-YaC1t_ukiZQ4gGM2kM_E";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connectivity...');
  console.log('📡 URL:', supabaseUrl);
  
  try {
    // Test 1: Basic connection test
    console.log('\n1️⃣ Testing basic connection...');
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      console.error('📊 Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('📊 Response:', data);
    }
    
    // Test 2: Try to insert a test user (will fail if table doesn't exist, but should connect)
    console.log('\n2️⃣ Testing user creation...');
    const testUserData = {
      clerk_user_id: 'test_user_' + Date.now(),
      name: 'Test User',
      email: 'test@example.com',
      photo_url: null,
      phone_number: null,
    };
    
    console.log('📝 Test user data:', testUserData);
    
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert(testUserData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ User creation test failed:', insertError);
      console.error('📊 Insert error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
    } else {
      console.log('✅ User creation test successful!');
      console.log('📊 Created user:', insertData);
      
      // Clean up - delete the test user
      console.log('\n🧹 Cleaning up test user...');
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('clerk_user_id', testUserData.clerk_user_id);
      
      if (deleteError) {
        console.error('⚠️ Failed to clean up test user:', deleteError);
      } else {
        console.log('✅ Test user cleaned up successfully');
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during Supabase test:', error);
    console.error('📊 Error stack:', error.stack);
    
    // Check if it's a network error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('🌐 This appears to be a network connectivity issue');
      console.error('🔧 Possible solutions:');
      console.error('   1. Check your internet connection');
      console.error('   2. Check if you\'re behind a firewall/proxy');
      console.error('   3. Try connecting to a different network');
      console.error('   4. Check DNS resolution');
    }
  }
}

// Run the test
testSupabaseConnection(); 