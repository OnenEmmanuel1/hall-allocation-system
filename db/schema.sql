-- ============================================
-- EHAS Database Schema
-- Examination Hall Allocation System
-- Faculty of Computing, UNICROSS
-- ============================================

-- Users table (authentication for both Admin and Student)
CREATE TABLE IF NOT EXISTS tbl_users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Administrator', 'Student') NOT NULL,
  linked_student_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Students table
CREATE TABLE IF NOT EXISTS tbl_students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  matric_no VARCHAR(20) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  level INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_matric (matric_no),
  INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Courses table
CREATE TABLE IF NOT EXISTS tbl_courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(20) NOT NULL UNIQUE,
  course_title VARCHAR(200) NOT NULL,
  department VARCHAR(100) NOT NULL,
  level INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course_code (course_code),
  INDEX idx_course_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Student-Course enrollment (many-to-many)
CREATE TABLE IF NOT EXISTS tbl_student_courses (
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES tbl_courses(course_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Examination halls
CREATE TABLE IF NOT EXISTS tbl_halls (
  hall_id INT AUTO_INCREMENT PRIMARY KEY,
  hall_name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL,
  location VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exam schedule (one row per course exam sitting)
CREATE TABLE IF NOT EXISTS tbl_exam_schedule (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  exam_date DATE NOT NULL,
  exam_time VARCHAR(20) NOT NULL,
  status ENUM('pending', 'allocated') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_course_datetime (course_id, exam_date, exam_time),
  FOREIGN KEY (course_id) REFERENCES tbl_courses(course_id) ON DELETE CASCADE,
  INDEX idx_schedule_date (exam_date),
  INDEX idx_schedule_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Allocations (produced by the engine)
CREATE TABLE IF NOT EXISTS tbl_allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  student_id INT NOT NULL,
  hall_id INT NOT NULL,
  seat_no INT DEFAULT NULL,
  allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_schedule_student (schedule_id, student_id),
  FOREIGN KEY (schedule_id) REFERENCES tbl_exam_schedule(schedule_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (hall_id) REFERENCES tbl_halls(hall_id) ON DELETE CASCADE,
  INDEX idx_alloc_student (student_id),
  INDEX idx_alloc_hall (hall_id),
  INDEX idx_alloc_schedule (schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add FK from tbl_users to tbl_students (after both tables exist)
ALTER TABLE tbl_users
  ADD CONSTRAINT fk_user_student
  FOREIGN KEY (linked_student_id) REFERENCES tbl_students(student_id)
  ON DELETE SET NULL;
