import pg from 'pg';

const adminUrl =
  process.env.DATABASE_ADMIN_URL
  ?? 'postgresql://shop:shop_local_password@127.0.0.1:5432/shop';

const databaseName = process.env.SHOP_TEST_DATABASE ?? 'shop_test';

const client = new pg.Client({ connectionString: adminUrl });

await client.connect();

try {
  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );

  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`Created database ${databaseName}`);
  } else {
    console.log(`Database ${databaseName} already exists`);
  }
} finally {
  await client.end();
}
