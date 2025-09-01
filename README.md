Here's your complete `README.md` file content with the Sequelize CLI commands section, structured for clarity and ease of use:

---

````markdown
# Sequelize CLI Commands

This section provides a quick reference for using Sequelize CLI with migrations, seeders, and models.

---

## 📦 Database Migrations

### 📁 Creating Migration Files

```bash
# Create users table migration
npx sequelize-cli migration:generate --name create-users-table

# Create devices table migration
npx sequelize-cli migration:generate --name create-devices-table

# Create products table migration
npx sequelize-cli migration:generate --name create-products-table

# Create additional indexes migration
npx sequelize-cli migration:generate --name add-indexes

# Create foreign key relationships
npx sequelize-cli migration:generate --name add-user-device-relations
````

### 🚀 Running Migrations

```bash
# Run all pending migrations
npx sequelize-cli db:migrate

# Run specific migration
npx sequelize-cli db:migrate --name <migration-filename>

# Check migration status
npx sequelize-cli db:migrate:status

# Undo the most recent migration
npx sequelize-cli db:migrate:undo

# Undo specific migration
npx sequelize-cli db:migrate:undo --name <migration-filename>

# Undo all migrations
npx sequelize-cli db:migrate:undo:all
```

---

## 🌱 Database Seeding

### ✏️ Creating Seeders

```bash
# Create admin users seeder
npx sequelize-cli seed:generate --name demo-users

# Create products seeder
npx sequelize-cli seed:generate --name demo-products

# Create devices seeder
npx sequelize-cli seed:generate --name demo-devices

# Create test data seeder
npx sequelize-cli seed:generate --name test-data
```

### 🔄 Running Seeders

```bash
# Run all seeders
npx sequelize-cli db:seed:all

# Run specific seeder
npx sequelize-cli db:seed --seed <seeder-filename>

# Undo most recent seeder
npx sequelize-cli db:seed:undo

# Undo specific seeder
npx sequelize-cli db:seed:undo --seed <seeder-filename>

# Undo all seeders
npx sequelize-cli db:seed:undo:all
```

---

## 🧱 Model Management

```bash
# Generate model with migration (recommended)
npx sequelize-cli model:generate --name User --attributes name:string,email:string

# Alternative: Create model only
npx sequelize-cli model:create --name Product --attributes name:string,price:float
```

---

> ✅ **Tip:** Always review generated migration and seeder files to customize them according to your schema and data requirements.

```

