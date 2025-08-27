1. Install Library
```
npm i
```

2. Run web server
```
npm run dev
```

# setting prisma

```
npx prisma init
```

- Create .env contains
```
DATABASE_URL="mysql://username:password@localhost:3306/employee?schema=public"
```

Update database type in schema.prisma to mysql
```
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Generate schema in schema.prisma
```
npx prisma db pull
```

Generate script in prisma script in node_modules
```
npx prisma generate
```