# Hall Allocation System

## Overview

This project is a **Node.js** back‑end application using **Express** and **EJS** templating to manage hall allocations for a school. It provides RESTful APIs and server‑side rendered pages for creating, editing, and viewing hall schedules.

## Features

- CRUD operations for halls, rooms, and schedules
- User authentication middleware (`middleware/auth.js`)
- Database initialization script (`db/init.js`)
- Clean HTML views with EJS templates (`views/`)
- Error handling with a dedicated error view (`views/error.ejs`)

## Prerequisites

- **Node.js** (v14 or later) and **npm** installed
- A compatible database (e.g., SQLite, MySQL) configured in `db/init.js`

## Setup

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd "nodejs  back-end/EJS/school project sw/hall allocation"

# Install dependencies
npm install
```

## Running the Application

```bash
# Start the development server
npm run dev
```

The server will start on `http://localhost:3000` (or the port defined in your `.env`).

## Environment Variables

Create a `.env` file in the project root with the following variables (example values):

```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hall_allocation
SECRET_KEY=your_jwt_secret
```

## Testing

To run any existing tests (if provided):

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your fork and open a Pull Request

Please ensure that your code follows the existing style and that you update the documentation if needed.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
