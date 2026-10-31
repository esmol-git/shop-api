# ADR 0003: CI как обязательный гейт

## Контекст

Фундамент каталога и склада (идемпотентность, CHECK, archive/DELETE, timestamps,
FK) зелёный локально. Без пайплайна на PR регрессии можно слить незамеченными.

## Решение

На каждый `pull_request` и `push` в `main` запускается один job:

1. Postgres 18 (service container)
2. `CREATE DATABASE shop_test`
3. `prisma generate` + `prisma migrate deploy`
4. `npm run build`
5. `npm test`
6. `npm run test:e2e`

Карточку каталога и следующие продуктовые срезы не смешиваем с этим:
сначала гейт, потом изменения на защищённой основе.

## Последствия

- Generated Prisma Client в CI всегда собирается заново (он в `.gitignore`).
- E2E читает `DATABASE_URL` из окружения; локальный fallback — `shop_test` на `:5433`.
- Lint в этот срез не входит.
