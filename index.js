const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();

// 1. Cấu hình Middleware (Bắt buộc phải có)
app.use(cors());
app.use(express.json()); // Giúp server đọc được dữ liệu JSON gửi từ React

// 2. Route kiểm tra server (Test)
app.get('/', (req, res) => {
  res.send('Chào Huy! Backend Tomo Ramen đang chạy.');
});

// 3. API ĐĂNG NHẬP (Phần Huy đang thiếu đây)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  console.log(`Đang kiểm tra đăng nhập cho: ${username}`);

  try {
    // Truy vấn tìm người dùng trong bảng users
    const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    // Kiểm tra nếu không tìm thấy user
    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Tài khoản không tồn tại trên hệ thống!" });
    }

    // Kiểm tra mật khẩu (Hiện tại so sánh trực tiếp, sau này sẽ dùng bcrypt)
    if (user.rows[0].password !== password) {
      return res.status(401).json({ message: "Mật khẩu không chính xác. Vui lòng thử lại!" });
    }

    // Nếu mọi thứ OK, trả về thông tin thành công
    res.json({
      message: "Đăng nhập thành công!",
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        full_name: user.rows[0].full_name,
        role: user.rows[0].role
      }
    });

  } catch (err) {
    console.error("Lỗi Database:", err.message);
    res.status(500).json({ message: "Máy chủ đang gặp sự cố kết nối Database!" });
  }
});



// 4. Khởi động Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Tomo Ramen đang chạy tại: http://localhost:${PORT}`);
});

// API Lấy danh sách tất cả món ăn
app.get('/api/products', async (req, res) => {
  try {
    const allProducts = await pool.query(
      `SELECT p.*, c.name AS category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       ORDER BY p.id DESC`
    );
    res.json(allProducts.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Lỗi khi lấy danh sách món ăn" });
  }
});

// 1. API Thêm món mới
app.post('/api/products', async (req, res) => {
  const { name, category_id, price, image_url, is_available } = req.body;
  try {
    const newProduct = await pool.query(
      `INSERT INTO products (name, category_id, price, image_url, is_available) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category_id, price, image_url, is_available]
    );
    res.json(newProduct.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Lỗi khi thêm món ăn" });
  }
});

// 2. API Cập nhật món ăn (Sửa)
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category_id, price, image_url, is_available } = req.body;
  try {
    const updateProduct = await pool.query(
      `UPDATE products 
       SET name = $1, category_id = $2, price = $3, image_url = $4, is_available = $5 
       WHERE id = $6 RETURNING *`,
      [name, category_id, price, image_url, is_available, id]
    );
    res.json(updateProduct.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Lỗi khi cập nhật món ăn" });
  }
});


// API XÓA MÓN ĂN
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Thực hiện lệnh xóa trong Database dựa trên ID
    const deleteProduct = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING *", 
      [id]
    );

    if (deleteProduct.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy món ăn để xóa!" });
    }

    res.json({ message: "Đã xóa món ăn thành công!" });
    console.log(`🗑️ Đã xóa món có ID: ${id}`);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Lỗi hệ thống khi xóa món!" });
  }
});

// API Đổi trạng thái nhanh (Toggle Available)
app.patch('/api/products/:id/status', async (req, res) => {
  const { id } = req.params;
  const { is_available } = req.body;
  try {
    await pool.query('UPDATE products SET is_available = $1 WHERE id = $2', [is_available, id]);
    res.json({ message: "Đã cập nhật trạng thái!" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});




// 1. Lấy danh sách (Sắp xếp theo sort_order)
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.message); }
});

// 2. Thêm mới
app.post('/api/categories', async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING *",
      [name, sort_order || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send(err.message); }
});

// 3. Cập nhật (Sửa)
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, sort_order } = req.body;
  try {
    const result = await pool.query(
      "UPDATE categories SET name = $1, sort_order = $2 WHERE id = $3 RETURNING *",
      [name, sort_order, id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send(err.message); }
});

// 4. Xóa (Kiểm tra xem có món ăn không)
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Kiểm tra xem có sản phẩm nào thuộc danh mục này không
    const checkProducts = await pool.query("SELECT id FROM products WHERE category_id = $1 LIMIT 1", [id]);
    
    if (checkProducts.rows.length > 0) {
      return res.status(400).json({ 
        message: "⚠️ Không thể xóa! Danh mục này vẫn còn món ăn bên trong. Hãy xóa hoặc chuyển món ăn sang nhóm khác trước." 
      });
    }

    await pool.query("DELETE FROM categories WHERE id = $1", [id]);
    res.json({ message: "Đã xóa thành công!" });
  } catch (err) { res.status(500).send(err.message); }
});




// Lấy danh sách bàn
app.get('/api/tables', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurant_tables ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.message); }
});

// Thêm bàn mới (Đúng tên bảng restaurant_tables)
app.post('/api/tables', async (req, res) => {
  const { table_number, qr_code_url } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO restaurant_tables (table_number, qr_code_url) VALUES ($1, $2) RETURNING *",
      [table_number, qr_code_url]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send(err.message); }
});

// Cập nhật trạng thái
app.patch('/api/tables/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE restaurant_tables SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: "Cập nhật thành công" });
  } catch (err) { res.status(500).send(err.message); }
});




// 1. API Lấy danh sách Users
app.get('/api/users', async (req, res) => {
    console.log("Đang lấy danh sách Users..."); 
    try {
        // Dùng pool.query (vì Huy đã khai báo pool ở trên đầu)
        const result = await pool.query("SELECT id, username, password, full_name, role, created_at FROM users ORDER BY id ASC");
        res.json(result.rows); // PostgreSQL trả về dữ liệu trong biến .rows
    } catch (err) {
        console.error("Lỗi SQL chi tiết:", err.message); 
        res.status(500).json({ error: err.message });
    }
});

// 2. API Thêm tài khoản mới
app.post('/api/users', async (req, res) => {
    const { username, password, full_name, role } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING *",
            [username, password, full_name, role]
        );
        res.json({ message: "Tạo tài khoản thành công", user: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. API Xóa tài khoản
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy người dùng!" });
        }
        res.json({ message: "Đã xóa người dùng thành công" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. API Cập nhật tài khoản
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, full_name, role } = req.body;
    try {
        const result = await pool.query(
            "UPDATE users SET username = $1, password = $2, full_name = $3, role = $4 WHERE id = $5 RETURNING *",
            [username, password, full_name, role, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy người dùng!" });
        }
        res.json({ message: "Cập nhật thành công", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// API Lấy danh sách đơn hàng kèm chi tiết món và ảnh
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id, 
        o.table_id, 
        o.total_amount, 
        o.status, 
        o.customer_name,  -- THÊM CỘT NÀY
        o.customer_phone, -- THÊM CỘT NÀY
        o.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'product_name', p.name,
            'quantity', oi.quantity,
            'image_url', p.image_url,
            'price', p.price,
            'item_status', oi.item_status
          ))
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id
        ), '[]') as items
      FROM orders o
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// xác nhận đơn hàng (Cập nhật trạng thái)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Đặt món mới (mỗi lần khách xác nhận tạo 1 đơn mới)
app.post('/api/orders', async (req, res) => {
  const { table_id, user_id, total_amount, items, customer_name, customer_phone } = req.body;
  console.log(`📩 Đơn mới - Bàn: ${table_id} - Khách: ${customer_name}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (table_id, user_id, total_amount, status, customer_name, customer_phone) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [table_id, user_id || null, total_amount, 'Chờ xác nhận', customer_name || 'Khách lẻ', customer_phone || '']
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, note, item_status) VALUES ($1, $2, $3, $4, $5)',
        [orderId, item.product_id, item.quantity, item.note || '', 'Đang chờ']
      );
    }

    await client.query(
      'UPDATE restaurant_tables SET status = $1 WHERE id = $2',
      ['Occupied', table_id]
    );

    await client.query('COMMIT');
    console.log('✅ Đã lưu đơn hàng ID:', orderId, 'kèm thông tin khách hàng.');
    res.status(201).json({ message: 'Đặt món thành công', orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ LỖI LƯU ĐƠN HÀNG:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống khi lưu đơn: ' + err.message });
  } finally {
    client.release();
  }
});


// API Thanh toán toàn bộ bàn
app.post('/api/tables/:id/checkout', async (req, res) => {
  const tableId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lấy thời gian hiện tại chuẩn xác
    const now = new Date().toISOString(); 

    // Cập nhật tất cả đơn của bàn này: đổi status và ĐỒNG BỘ updated_at
    const result = await client.query(
      `UPDATE orders 
       SET status = $1, updated_at = $2 
       WHERE table_id = $3 AND status != $1`,
      ['Đã thanh toán', now, tableId]
    );

    // Mở lại bàn trống
    await client.query('UPDATE restaurant_tables SET status = $1 WHERE id = $2', ['Đang mở', tableId]);

    await client.query('COMMIT');
    res.json({ message: "Thanh toán thành công" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});