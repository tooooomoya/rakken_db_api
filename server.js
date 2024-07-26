const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Listen for connections
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  host: 'dpg-cqebshogph6c73alj13g-a.singapore-postgres.render.com',
  user: 'tooooomoya', // 例: 'postgres'
  password: '5Vxyx6YL14VSQXgQgQCrJNWVGXjfLmqE', // 環境変数に移すことを推奨します
  database: 'rakken_database',
  port: 5432,
  
  ssl: {
    rejectUnauthorized: false, // 証明書の検証はいったん無しで
  },
});

// Connect to PostgreSQL
pool.connect(err => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    console.log('Connected to PostgreSQL');
  }
});

// APIエンドポイントを作成
app.get('/api/audios', (req, res) => {
  const keyword = req.query.keyword ? `%${req.query.keyword}%` : '%';
  const query = `
    SELECT a.*, t.title_name, p.player_name, s.show_name 
    FROM audios a
    LEFT JOIN titles t ON a.title_id = t.title_id
    LEFT JOIN players p ON a.player_id = p.player_id
    LEFT JOIN shows s ON a.show_id = s.show_id
    WHERE t.title_name LIKE $1 OR p.player_name LIKE $1 OR s.show_name LIKE $1
  `;

  pool.query(query, [keyword], (err, results) => {
    if (err) {
      console.error('Error fetching data from PostgreSQL:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results.rows);
  });
});

// タイトル、演者、ショーのデータを取得するエンドポイント
app.get('/api/titles', (req, res) => {
  const keyword = req.query.keyword ? `%${req.query.keyword}%` : '%';
  const query = `
    SELECT * FROM titles
    WHERE title_name LIKE $1
  `;
  
  pool.query(query, [keyword], (err, results) => {
    if (err) {
      console.error('Error fetching data from PostgreSQL:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results.rows);
  });
});

app.get('/api/players', (req, res) => {
  const keyword = req.query.keyword ? `%${req.query.keyword}%` : '%';
  const query = `
    SELECT * FROM players
    WHERE player_name LIKE $1
  `;
  
  pool.query(query, [keyword], (err, results) => {
    if (err) {
      console.error('Error fetching data from PostgreSQL:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results.rows);
  });
});

app.get('/api/shows', (req, res) => {
  const keyword = req.query.keyword ? `%${req.query.keyword}%` : '%';
  const query = `
    SELECT * FROM shows
    WHERE show_name LIKE $1 OR show_location LIKE $1
  `;
  
  pool.query(query, [keyword], (err, results) => {
    if (err) {
      console.error('Error fetching data from PostgreSQL:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results.rows);
  });
});

// 新しいオーディオを登録するエンドポイント
app.post('/api/audios', (req, res) => {
  const { link, title_id, player_id, show_id, memo } = req.body;

  if (!title_id || !player_id || !show_id) {
    res.status(400).json({ message: 'Title, Player, and Show are required' });
    return;
  }

  const query = 'INSERT INTO audios (link, title_id, player_id, show_id, memo) VALUES ($1, $2, $3, $4, $5)';
  pool.query(query, [link, title_id, player_id, show_id, memo], (error, results) => {
    if (error) {
      console.error('Error inserting audio:', error);
      res.status(500).json({ message: 'Error inserting audio' });
      return;
    }
    res.json({ message: 'Audio registered successfully', audio_id: results.insertId });
  });
});


app.post('/api/titles', async (req, res) => {
  const { title_name } = req.body;

  if (!title_name) {
    res.status(400).json({ message: 'Title is required' });
    return;
  }

  const checkQuery = 'SELECT * FROM titles WHERE title_name = $1';
  const checkResult = await pool.query(checkQuery, [title_name]);

  if (checkResult.rows.length > 0) {
    return res.status(409).json({ error: 'Title already exists' });
  }

  const query = 'INSERT INTO titles (title_name) VALUES ($1)';
  pool.query(query, [title_name], (error, results) => {
    if (error) {
      console.error('Error inserting title:', error);
      res.status(500).json({ message: 'Error inserting title' });
      return;
    }
    res.json({ message: 'Title registered successfully', title_id: results.insertId });
  });
});



app.post('/api/players', (req, res) => {
  const { player_name, player_num } = req.body;

  if (!player_name) {
    res.status(400).json({ message: 'PlayerName is required' });
    return;
  }

  // 既存のプレイヤーがいるかどうかを確認するクエリ
  const checkQuery = 'SELECT * FROM players WHERE player_name = $1 AND player_num = $2';
  pool.query(checkQuery, [player_name, player_num], (checkError, checkResults) => {
    if (checkError) {
      console.error('Error checking player:', checkError);
      res.status(500).json({ message: 'Error checking player' });
      return;
    }

    if (checkResults.rows.length > 0) {
      // プレイヤーが既に存在する場合
      res.status(409).json({ message: 'Player with the same name and number already exists' });
    } else {
      // プレイヤーが存在しない場合、挿入を実行
      const insertQuery = 'INSERT INTO players (player_name, player_num) VALUES ($1, $2)';
      pool.query(insertQuery, [player_name, player_num], (insertError, insertResults) => {
        if (insertError) {
          console.error('Error inserting player:', insertError);
          res.status(500).json({ message: 'Error inserting player' });
          return;
        }
        res.json({ message: 'Player registered successfully', player_id: insertResults.insertId });
      });
    }
  });
});




app.post('/api/shows', async (req, res) => {
  const { show_name, show_date, show_location } = req.body;

  if (!show_name) {
    res.status(400).json({ message: 'ShowName is required' });
    return;
  }

  const checkQuery = 'SELECT * FROM shows WHERE show_name = $1';
  const checkResult = await pool.query(checkQuery, [show_name]);

  if (checkResult.rows.length > 0) {
    return res.status(409).json({ error: 'Show already exists' });
  }

  const query = 'INSERT INTO shows (show_name, show_date, show_location) VALUES ($1, $2, $3)';
  pool.query(query, [show_name, show_date, show_location], (error, results) => {
    if (error) {
      console.error('Error inserting show:', error);
      res.status(500).json({ message: 'Error inserting show' });
      return;
    }
    res.json({ message: 'Show registered successfully', show_id: results.insertId });
  });
});



//Postgresql（テスト環境）
/*
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Listen for connections
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  host: 'localhost',
  user: 'postgres', // 例: 'postgres'
  password: 'Tomoya-leo9', // 環境変数に移すことを推奨します
  database: 'myapp00',
  port: 5432
});

// Connect to PostgreSQL
pool.connect(err => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    console.log('Connected to PostgreSQL');
  }
});

// APIエンドポイントを作成
app.get('/api/audios', (req, res) => {
  const keyword = req.query.keyword ? `%${req.query.keyword}%` : '%';
  const query = `
    SELECT a.*, t.title_name, p.player_name, s.show_name 
    FROM audios a
    LEFT JOIN titles t ON a.title_id = t.title_id
    LEFT JOIN players p ON a.player_id = p.player_id
    LEFT JOIN shows s ON a.show_id = s.show_id
    WHERE t.title_name LIKE $1 OR p.player_name LIKE $1 OR s.show_name LIKE $1
  `;

  pool.query(query, [keyword], (err, results) => {
    if (err) {
      console.error('Error fetching data from PostgreSQL:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results.rows);
  });
});

// タイトル、演者、ショーのデータを取得するエンドポイント
app.get('/api/titles', (req, res) => {
  pool.query('SELECT * FROM titles', (error, results) => {
    if (error) {
      console.error('Error fetching titles:', error);
      res.status(500).json({ message: 'Error fetching titles' });
      return;
    }
    res.json(results.rows);
  });
});

app.get('/api/players', (req, res) => {
  pool.query('SELECT * FROM players', (error, results) => {
    if (error) {
      console.error('Error fetching players:', error);
      res.status(500).json({ message: 'Error fetching players' });
      return;
    }
    res.json(results.rows);
  });
});

app.get('/api/shows', (req, res) => {
  pool.query('SELECT * FROM shows', (error, results) => {
    if (error) {
      console.error('Error fetching shows:', error);
      res.status(500).json({ message: 'Error fetching shows' });
      return;
    }
    res.json(results.rows);
  });
});

// 新しいオーディオを登録するエンドポイント
app.post('/api/audios', (req, res) => {
  const { link, title_id, player_id, show_id, memo } = req.body;

  if (!title_id || !player_id || !show_id) {
    res.status(400).json({ message: 'Title, Player, and Show are required' });
    return;
  }

  const query = 'INSERT INTO audios (link, title_id, player_id, show_id, memo) VALUES ($1, $2, $3, $4, $5)';
  pool.query(query, [link, title_id, player_id, show_id, memo], (error, results) => {
    if (error) {
      console.error('Error inserting audio:', error);
      res.status(500).json({ message: 'Error inserting audio' });
      return;
    }
    res.json({ message: 'Audio registered successfully', audio_id: results.insertId });
  });
});

app.post('/api/titles', (req, res) => {
  const { title_name } = req.body;

  if (!title_name) {
    res.status(400).json({ message: 'Title is required' });
    return;
  }

  const query = 'INSERT INTO titles (title_name) VALUES ($1)';
  pool.query(query, [title_name], (error, results) => {
    if (error) {
      console.error('Error inserting title:', error);
      res.status(500).json({ message: 'Error inserting title' });
      return;
    }
    res.json({ message: 'Title registered successfully', title_id: results.insertId });
  });
});

app.post('/api/players', (req, res) => {
  const { player_name, player_num } = req.body;

  if (!player_name) {
    res.status(400).json({ message: 'PlayerName is required' });
    return;
  }

  const query = 'INSERT INTO players (player_name, player_num) VALUES ($1, $2)';
  pool.query(query, [player_name, player_num], (error, results) => {
    if (error) {
      console.error('Error inserting player:', error);
      res.status(500).json({ message: 'Error inserting player' });
      return;
    }
    res.json({ message: 'Player registered successfully', player_id: results.insertId });
  });
});

app.post('/api/shows', (req, res) => {
  const { show_name, show_date, show_location } = req.body;

  if (!show_name) {
    res.status(400).json({ message: 'ShowName is required' });
    return;
  }

  const query = 'INSERT INTO shows (show_name, show_date, show_location) VALUES ($1, $2, $3)';
  pool.query(query, [show_name, show_date, show_location], (error, results) => {
    if (error) {
      console.error('Error inserting show:', error);
      res.status(500).json({ message: 'Error inserting show' });
      return;
    }
    res.json({ message: 'Show registered successfully', show_id: results.insertId });
  });
});




//Mysql（テスト環境）
/*
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

//以下のlistenがないとAPIサーバーは動かない。
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Tomoya-leo9', // セキュリティのために環境変数に移すことを推奨します
  database: 'myapp00'
});

connection.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL');
});

// APIエンドポイントを作成
app.get('/api/audios', (req, res) => {
  const keyword = req.query.keyword ? `%${req.query.keyword}%` : '%';
  const query = `
    SELECT a.*, t.title_name, p.player_name, s.show_name 
    FROM audios a
    LEFT JOIN titles t ON a.title_id = t.title_id
    LEFT JOIN players p ON a.player_id = p.player_id
    LEFT JOIN shows s ON a.show_id = s.show_id
    WHERE t.title_name LIKE ? OR p.player_name LIKE ? OR s.show_name LIKE ?
  `;

  connection.query(query, [keyword, keyword, keyword], (err, results) => {
    if (err) {
      console.error('Error fetching data from MySQL:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results);
  });
});

  
// タイトル、演者、ショーのデータを取得するエンドポイント
app.get('/api/titles', (req, res) => {
  connection.query('SELECT * FROM titles', (error, results) => {
    if (error) {
      console.error('Error fetching titles:', error);
      res.status(500).json({ message: 'Error fetching titles' });
      return;
    }
    res.json(results);
  });
});

app.get('/api/players', (req, res) => {
  connection.query('SELECT * FROM players', (error, results) => {
    if (error) {
      console.error('Error fetching players:', error);
      res.status(500).json({ message: 'Error fetching players' });
      return;
    }
    res.json(results);
  });
});

app.get('/api/shows', (req, res) => {
  connection.query('SELECT * FROM shows', (error, results) => {
    if (error) {
      console.error('Error fetching shows:', error);
      res.status(500).json({ message: 'Error fetching shows' });
      return;
    }
    res.json(results);
  });
});

// 新しいオーディオを登録するエンドポイント
app.post('/api/audios', (req, res) => {
  const { link, title_id, player_id, show_id, memo } = req.body;

  if (!title_id || !player_id || !show_id) {
    res.status(400).json({ message: 'Title, Player, and Show are required' });
    return;
  }

  const query = 'INSERT INTO audios (link, title_id, player_id, show_id, memo) VALUES (?, ?, ?, ?, ?)';
  connection.query(query, [link, title_id, player_id, show_id, memo], (error, results) => {
    if (error) {
      console.error('Error inserting audio:', error);
      res.status(500).json({ message: 'Error inserting audio' });
      return;
    }
    res.json({ message: 'Audio registered successfully', audio_id: results.insertId });
  });
});  

app.post('/api/titles', (req, res) => {
  const { title_name } = req.body;

  if (!title_name) {
    res.status(400).json({ message: 'Title is required' });
    return;
  }

  const query = 'INSERT INTO titles (title_name) VALUES (?)';
  connection.query(query, [title_name], (error, results) => {
    if (error) {
      console.error('Error inserting title:', error);
      res.status(500).json({ message: 'Error inserting title' });
      return;
    }
    res.json({ message: 'Title registered successfully', title_id: results.insertId });
  });
});


app.post('/api/players', (req, res) => {
  const { player_name, player_num } = req.body;

  if (!player_name) {
    res.status(400).json({ message: 'PlayerName is required' });
    return;
  }

  const query = 'INSERT INTO players (player_name, player_num) VALUES (?, ?)';
  //?には以下のquery配列が入る。
  connection.query(query, [player_name, player_num], (error, results) => {
    if (error) {
      console.error('Error inserting player:', error);
      res.status(500).json({ message: 'Error inserting player' });
      return;
    }
    res.json({ message: 'Player registered successfully', player_name: results.insertId });
  });
});


app.post('/api/shows', (req, res) => {
  const { show_name, show_date, show_location } = req.body;

  if (!show_name) {
    res.status(400).json({ message: 'ShowName is required' });
    return;
  }

  const query = 'INSERT INTO shows (show_name, show_date, show_location) VALUES (?, ?, ?)';
  //?には以下のquery配列が入る。
  connection.query(query, [show_name, show_date, show_location], (error, results) => {
    if (error) {
      console.error('Error inserting show:', error);
      res.status(500).json({ message: 'Error inserting show' });
      return;
    }
    res.json({ message: 'Show registered successfully', show_name: results.insertId });
  });
});
*/