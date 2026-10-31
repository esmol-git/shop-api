# Проверка среза A (категории) — аудит реализации

Дата: 2026-10-31 (обновлено после ревью маппера/e2e/DTO).

## Матрица

| Проверка | Где реализована | Какой тест подтверждает | Статус |
|---|---|---|---|
| Create корень / null parent | use case + DTO | e2e parentId omit/null | OK |
| Create с родителем ≤4 | `CATEGORY_MAX_DEPTH` | e2e 4 уровня + unit | OK |
| Parent missing → 404, нет строки | P2003 parent FK | e2e | OK |
| Depth 5 → 409, нет строки | use case до add | e2e | OK |
| Slug taken → 409 | UNIQUE + точный P2002 | e2e seq + race | OK |
| P2002 только `categories_slug_key` | `prisma-category-slug-unique` | unit отрицательные кейсы | OK |
| Нормализация slug trim+lower | CreateCategoryDto | e2e `KESSONY-…` → `kessony-…` + 409 | OK |
| `bad slug` → 400 | Matches после lower | e2e | OK |
| Slug len 1 / 100 / 101 | DTO + VO | e2e | OK |
| Slug omitted / null / "" → 400 | DTO required | e2e | OK |
| Неверные типы / extra → 400, нет строки | ValidationPipe | e2e | OK |
| PATCH no-op `{}` / same name | RenameCategoryUseCase | unit `update` not called; e2e `updatedAt` | OK |
| PATCH null/empty/whitespace → 400 | RenameCategoryDto | e2e | OK |
| PATCH slug/parentId/id/dates → 400 | forbidNonWhitelisted | e2e | OK |
| PATCH missing → 404 | use case | e2e | OK |
| PATCH rename: стабильные поля, `updatedAt`↑ | repository update | e2e | OK |
| Last-write-wins rename | нет версий | ADR 0006 | OK (ограничение) |
| Пустое дерево `[]` | `buildCategoryTree` | unit | OK |
| Несколько корней/детей; узел 1 раз; листья | tree builder | e2e | OK |
| Одинаковые имена-соседи в дереве по id | findAll order | e2e twins | OK |
| Порядок только в findAll | repository / output | unit + e2e | OK |
| `GET /tree` ≠ `:id`; GET missing 404 | routes | e2e | OK |
| Self-parent CHECK | follow-up migration | e2e raw SQL | OK |
| Cleanup всегда + assert 0 | e2e helper | finally + count | OK |
| Уникальные фикстуры runId | e2e | runId suffix | OK |
| List/tree целиком | ADR | док. | OK |
| Явный slug (без автоgen) | ADR | контракт | OK |

## Ограничения A

Нет move/delete; нет автоslug; нет пагинации; rename last-write-wins; глубина вне Serializable B.

## Гейт к B

Матрица без «пробел»; блокеры ревью закрыты; `npm run ci` зелёный.
