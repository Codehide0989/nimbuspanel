/**
 * CLI: Create Owner Admin Account
 * Usage: npx tsx scripts/create-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import * as readline from "readline";

const prisma = new PrismaClient();

function ask(question: string, hidden: boolean = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      let input = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (char: string) => {
        if (char === "\n" || char === "\r") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (char === "\u0003") {
          process.exit();
        } else if (char === "\u007f") {
          input = input.slice(0, -1);
        } else {
          input += char;
          process.stdout.write("*");
        }
      });
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function main() {
  console.log("\n⚡ NimbusPanel — Create Owner Account\n");

  // Check if owner already exists
  const existingOwner = await prisma.teamMember.findFirst({ where: { role: "OWNER" } });
  if (existingOwner) {
    console.error("✗ Owner account already exists.");
    console.error("  Use the application to manage users.\n");
    process.exit(1);
  }

  const name = await ask("  Name: ");
  const email = await ask("  Email: ");
  const password = await ask("  Password: ", true);
  const confirmPassword = await ask("  Confirm Password: ", true);

  if (!name || !email || !password) {
    console.error("\n✗ All fields are required.");
    process.exit(1);
  }

  if (password !== confirmPassword) {
    console.error("\n✗ Passwords do not match.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("\n✗ Password must be at least 8 characters.");
    process.exit(1);
  }

  console.log("\n  Creating owner account...");

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Create workspace
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";

  const workspace = await prisma.workspace.create({
    data: { name: `${name}'s Workspace`, slug },
  });

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
    },
  });

  // Create team membership as OWNER
  await prisma.teamMember.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
  });

  console.log("\n✓ Owner account created successfully!");
  console.log(`  Email: ${email}`);
  console.log(`  Role: Owner`);
  console.log(`  Workspace: ${workspace.name}`);
  console.log(`\n  You can now login at: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
