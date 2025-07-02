# 🐾 TrainIt - Animal Training Plan Tracker

A web application for tracking animal training plans with time estimations and actuals, similar to Gantt charts.

## Features

- **User Authentication**: Secure login and signup system with JWT tokens
- **Animal Management**: Add, edit, and manage animals with detailed profiles
- **Training Session Logging**: Track training durations and timestamps with optional animal association
- **Modern UI**: Clean, responsive interface with tabbed navigation
- **RESTful API**: FastAPI backend with automatic documentation

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite
- **Authentication**: JWT tokens with bcrypt password hashing
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Database**: SQLite (can be easily migrated to PostgreSQL/MySQL)

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd trainit
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment**:
   - Windows:
     ```bash
     .venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source .venv/bin/activate
     ```

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

1. **Start the backend server** (in one terminal):
   ```bash
   python run_backend.py
   ```
   The API will be available at `http://localhost:8000`

2. **Start the frontend server** (in another terminal):
   ```bash
   python serve_frontend.py
   ```
   This will automatically open your browser to `http://localhost:3000`

   **Alternative**: If you prefer to serve the frontend manually:
   ```bash
   cd frontend
   python -m http.server 3000
   ```
   Then visit `http://localhost:3000`

3. **API Documentation**:
   - Interactive API docs: `http://localhost:8000/docs`
   - Alternative docs: `http://localhost:8000/redoc`

## Usage

### First Time Setup

1. Open the application in your browser
2. Click "Don't have an account? Sign up"
3. Create a new account with your email and password
4. Login with your credentials

### Logging Training Sessions

1. After logging in, you'll see the dashboard
2. Enter the duration of your training session in minutes
3. Click "Log Training Session"
4. Your session will be saved with a timestamp

## API Endpoints

### Authentication
- `POST /auth/signup` - Create a new user account
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info (requires authentication)

### Training Plans
- `GET /plans/` - List training plans (placeholder)
- `POST /plans/log` - Log a training session (requires authentication)
- `GET /plans/stats` - Get user training statistics (requires authentication)
- `GET /plans/logs` - Get recent training logs (requires authentication)

### Animals
- `POST /animals/` - Create a new animal (requires authentication)
- `GET /animals/` - List all user's animals (requires authentication)
- `GET /animals/{id}` - Get specific animal details (requires authentication)
- `PUT /animals/{id}` - Update animal information (requires authentication)
- `DELETE /animals/{id}` - Delete an animal (requires authentication)

## Database Schema

### Users Table
- `id` (Primary Key)
- `email` (Unique)
- `hashed_password`

### Animals Table
- `id` (Primary Key)
- `name` (String - required)
- `species` (String - required)
- `sex` (String - Male/Female/Unknown)
- `age` (Integer - years, optional)
- `location` (String - optional)
- `owner_id` (Foreign Key to Users)

### TimeLogs Table
- `id` (Primary Key)
- `duration` (Float - minutes)
- `timestamp` (DateTime)
- `notes` (String - optional)
- `user_id` (Foreign Key to Users)
- `animal_id` (Foreign Key to Animals - optional)

## Development

### Project Structure
```
trainit/
├── backend/
│   └── app/
│       ├── routes/
│       │   ├── auth.py
│       │   └── plans.py
│       ├── main.py
│       ├── models.py
│       ├── schemas.py
│       ├── crud.py
│       ├── database.py
│       └── auth_utils.py
├── frontend/
│   └── index.html
├── requirements.txt
├── run_backend.py
└── README.md
```

### Adding New Features

1. **Database Models**: Add new models in `backend/app/models.py`
2. **API Schemas**: Define request/response schemas in `backend/app/schemas.py`
3. **CRUD Operations**: Add database operations in `backend/app/crud.py`
4. **API Routes**: Create new route files in `backend/app/routes/`
5. **Frontend**: Update `frontend/index.html` for new UI features

## Security Notes

- The JWT secret key should be changed in production
- Passwords are hashed using bcrypt
- CORS is configured for development (localhost)
- Consider using environment variables for sensitive configuration

## Troubleshooting

### CORS Errors
If you see "Cross-Origin Request Blocked" errors:
1. Make sure the backend server is running (`python run_backend.py`)
2. Use the frontend server (`python serve_frontend.py`) instead of opening the HTML file directly
3. Check that both servers are running on the correct ports (backend: 8000, frontend: 3000)

### Module Import Errors
If you see "ModuleNotFoundError: No module named 'app'":
1. Make sure you're running `python run_backend.py` from the project root directory
2. Check that all dependencies are installed: `pip install -r requirements.txt`
3. Verify the virtual environment is activated

### Database Issues
If the database seems to reset or lose data:
- The SQLite database file is located at `backend/app.db`
- Make sure the backend directory has write permissions

## Future Enhancements

- Training plan creation and management
- Gantt chart visualization
- Progress tracking and analytics
- Multiple animal support
- Training goal setting
- Export functionality
- Mobile app support

## License

This project is open source and available under the MIT License.
