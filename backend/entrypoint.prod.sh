#!/bin/sh
# Điểm vào production: migrate + collectstatic rồi chạy gunicorn.
# Đối số "serve" (mặc định) chạy production; đối số khác (vd: python manage.py test)
# được thực thi trực tiếp để dùng cho dev và CI.
set -e

if [ "$1" = "serve" ] || [ -z "$1" ]; then
  echo ">> Chạy migrate..."
  python manage.py migrate --noinput
  echo ">> Thu thập file tĩnh..."
  python manage.py collectstatic --noinput
  echo ">> Khởi động gunicorn..."
  exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-2}" \
    --timeout 60 \
    --access-logfile - --error-logfile -
fi

exec "$@"
