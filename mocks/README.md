# Mocks data

## Purpose

The `mocks/` directory contains mock data for the application, which can be used for testing and development purposes. This data is structured to simulate real-world scenarios and can help developers understand how the application behaves with different inputs.

* Tree of the `mocks/` directory:

```
mocks/
├── seed.sql                # SQL script to seed the database with mock data
├── seed-roles.sql          # SQL script to seed the database with mock roles
├── login.txt               # Text file containing mock login data
└── transactions.csv        # CSV file containing mock transaction data
```

Contents of the *seed.sql*:
- 50 employees
- 6 partners across 6 categories
- 12 employer companies
- 200 transactions (payments, refunds, and top-ups) over 90 days

## How to seed the database with mocks

To seed the database with mock data, follow these steps:
1. Ensure you have a running database instance.
2. Run the `/dev/seed.sh {file_sql} {container_app_name} {container_db_name}` script.