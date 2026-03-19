import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  dialect: "mysql",
  logging: false,
});

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "student"),
      allowNull: false,
      defaultValue: "student",
    },
    student_number: {
      type: DataTypes.STRING(20),
      unique: true,
    },
  },
  {
    tableName: "users",
    timestamps: false,
  },
);

export async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await sequelize.authenticate();
  await sequelize.transaction(async (transaction) => {
    await User.upsert(
      {
        name: "SchoolLink Admin",
        email: adminEmail.toLowerCase(),
        password_hash: hashedPassword,
        role: "admin",
      },
      { transaction },
    );
  });

  console.log(`Admin account seeded (${adminEmail.toLowerCase()})`);
}

async function run() {
  try {
    await ensureAdmin();
  } catch (err) {
    console.error("Admin seeding failed:", err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  run();
}
