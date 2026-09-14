// Uso: npm run admin:hash -- "minhaSenhaForte123"
// Copie o hash impresso e cole em ADMIN_PASSWORD_HASH no seu .env
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.log('Uso: npm run admin:hash -- "sua-senha-aqui"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nAdicione isto ao seu .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
