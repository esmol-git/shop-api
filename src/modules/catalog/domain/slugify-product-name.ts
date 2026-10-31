import { ProductSlug } from './value-objects/product-slug.js';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

function transliterate(input: string): string {
  let result = '';

  for (const char of input.toLowerCase()) {
    if (Object.hasOwn(CYRILLIC_TO_LATIN, char)) {
      result += CYRILLIC_TO_LATIN[char];
      continue;
    }

    result += char;
  }

  return result;
}

export function slugifyProductName(name: string): string {
  const transliterated = transliterate(name.trim());

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
}

export function productSlugFallbackFromId(productId: string): string {
  return `product-${productId.replaceAll('-', '').slice(0, 8)}`;
}

export function resolveProductSlug(
  productId: string,
  name: string,
  explicitSlug?: string | null,
): ProductSlug {
  if (explicitSlug !== undefined && explicitSlug !== null) {
    return ProductSlug.create(explicitSlug);
  }

  const fromName = slugifyProductName(name);

  if (fromName.length > 0) {
    return ProductSlug.create(fromName);
  }

  return ProductSlug.create(productSlugFallbackFromId(productId));
}
