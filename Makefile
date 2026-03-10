.PHONY: up down build logs ps restart shell-backend shell-scanner db-shell

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

restart:
	docker compose restart

shell-backend:
	docker compose exec backend sh

shell-scanner:
	docker compose exec scanner bash

db-shell:
	docker compose exec postgres psql -U securityscan -d securityscan

ssl-init:
	docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $(DOMAIN) --email $(EMAIL) --agree-tos --no-eff-email

deploy:
	git pull
	docker compose build
	docker compose up -d
	docker compose ps
