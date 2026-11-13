# TAMUR Open the Safe — statik frontend, API Supabase'da qoladi.
FROM nginx/nginx-unprivileged:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY js/ /usr/share/nginx/html/js/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY fonts/ /usr/share/nginx/html/fonts/
COPY tamur-logo-mark.png tamur-logo.jpg tamur-store.jpg TAMUR_video_GitHub.mp4 /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz | grep -qx ok || exit 1
