# Family Tree (Django + React)

Backend (Django):

- Run in a Python virtualenv and install dependencies:

```bash
python -m venv env
env\Scripts\activate   # Windows
pip install -r requirements.txt
```

- Run migrations and start server:

```bash
python manage.py migrate
python manage.py runserver
```

Frontend (React, Vite):

```bash
cd familytree_front
npm install
npm run dev
```

The project uses `.env` at the repository root for `SECRET_KEY`, `DEBUG`, and `DATABASE_NAME`.

Birthday notifications:

- There's a management command to list today's birthdays (placeholder for sending emails):

```bash
python manage.py send_birthday_notifications
```

Media uploads:

- Uploaded photos are stored in the `media/photos/` directory. In development the files are served automatically when `DEBUG=True`.

