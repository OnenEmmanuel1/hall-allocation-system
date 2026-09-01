/**
 * EHAS Database Initializer
 * Creates database, runs schema, seeds demo data with bcrypt-hashed passwords.
 * Usage: node db/init.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  const dbName = process.env.DB_NAME || 'ehas';

  /* Connect without selecting a database first */
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('🔧  Creating database...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);

    /* Drop existing tables in correct order */
    await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);
    const [existingTables] = await connection.query(`SHOW TABLES`);
    for (const row of existingTables) {
      const tableName = Object.values(row)[0];
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
    await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);

    console.log('📋  Running schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);

    console.log('🌱  Seeding data...');
    const hash = await bcrypt.hash('password123', 10);

    /* ── Students ── */
    await connection.query(
      `INSERT INTO tbl_students (full_name, matric_no, department, level) VALUES
        (?, ?, ?, ?),
        (?, ?, ?, ?),
        (?, ?, ?, ?),
        (?, ?, ?, ?),
        (?, ?, ?, ?)`,
      [
        'Blessing Udo',   'CRS/20/CMP/001', 'Computer Science', 100,
        'Emmanuel Obi',   'CRS/20/CMP/002', 'Computer Science', 100,
        'Favour Inyang',  'CRS/20/CMP/003', 'Computer Science', 100,
        'Daniel Etim',    'CRS/19/CMP/001', 'Computer Science', 200,
        'Sarah Ndem',     'CRS/19/CMP/002', 'Computer Science', 200
      ]
    );

    /* ── Users ── */
    await connection.query(
      `INSERT INTO tbl_users (username, password_hash, role, linked_student_id) VALUES
        (?, ?, 'Administrator', NULL),
        (?, ?, 'Student', 1),
        (?, ?, 'Student', 2),
        (?, ?, 'Student', 3),
        (?, ?, 'Student', 4),
        (?, ?, 'Student', 5)`,
      [
        'admin@unicross.edu.ng', hash,
        'student1@unicross.edu.ng', hash,
        'student2@unicross.edu.ng', hash,
        'student3@unicross.edu.ng', hash,
        'student4@unicross.edu.ng', hash,
        'student5@unicross.edu.ng', hash
      ]
    );

    /* ── Courses ── */
    await connection.query(
      `INSERT INTO tbl_courses (course_code, course_title, department, level) VALUES
        ('CMP101', 'Introduction to Computer Science', 'Computer Science', 100),
        ('CMP102', 'Programming Fundamentals',         'Computer Science', 100),
        ('CMP103', 'Computer Hardware',                'Computer Science', 100),
        ('CMP201', 'Data Structures and Algorithms',   'Computer Science', 200),
        ('CMP202', 'Database Management Systems',      'Computer Science', 200),
        ('CMP203', 'Web Development',                  'Computer Science', 200)`
    );

    /* ── Student-Course Enrollments ── */
    /* Level 100 students (IDs 1,2,3) → CMP101, CMP102, CMP103 (IDs 1,2,3) */
    /* Level 200 students (IDs 4,5)   → CMP201, CMP202, CMP203 (IDs 4,5,6) */
    await connection.query(
      `INSERT INTO tbl_student_courses (student_id, course_id) VALUES
        (1, 1), (1, 2), (1, 3),
        (2, 1), (2, 2), (2, 3),
        (3, 1), (3, 2), (3, 3),
        (4, 4), (4, 5), (4, 6),
        (5, 4), (5, 5), (5, 6)`
    );

    /* ── Halls ── */
    await connection.query(
      `INSERT INTO tbl_halls (hall_name, capacity, location) VALUES
        ('Exam Hall A',   200, 'Main Campus Block A'),
        ('Exam Hall B',   150, 'Main Campus Block B'),
        ('Exam Hall C',    80, 'Science Building'),
        ('Computer Lab',   40, 'ICT Centre')`
    );

    /* ── Exam Schedules (6 exams across 3 days × 2 time slots) ── */
    await connection.query(
      `INSERT INTO tbl_exam_schedule (course_id, exam_date, exam_time, status) VALUES
        (1, '2026-09-15', '09:00 AM - 12:00 PM', 'pending'),
        (2, '2026-09-15', '02:00 PM - 05:00 PM', 'pending'),
        (3, '2026-09-16', '09:00 AM - 12:00 PM', 'pending'),
        (4, '2026-09-16', '02:00 PM - 05:00 PM', 'pending'),
        (5, '2026-09-17', '09:00 AM - 12:00 PM', 'pending'),
        (6, '2026-09-17', '02:00 PM - 05:00 PM', 'pending')`
    );

    console.log('');
    console.log('✅  Database initialized successfully!');
    console.log('');
    console.log('   Default credentials:');
    console.log('   Password: password123');
    console.log('');
    console.log('   Admin:     admin@unicross.edu.ng');
    console.log('   Student 1: student1@unicross.edu.ng');
    console.log('   Student 2: student2@unicross.edu.ng');
    console.log('   Student 3: student3@unicross.edu.ng');
    console.log('   Student 4: student4@unicross.edu.ng');
    console.log('   Student 5: student5@unicross.edu.ng');
    console.log('');
  } catch (error) {
    console.error('❌  Error initializing database:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

initDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
