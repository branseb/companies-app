import path from "path";
import { DataSource } from "typeorm";
import { BankAccount } from "./entities/bankAccount";
import { BankTransaction } from "./entities/bankTransaction";
import { CashRegister } from "./entities/cashRegister";
import { CashEntry } from "./entities/cashEntry";
import { Company } from "./entities/company";
import { Invoice } from "./entities/invoice";

const connectionString1 = 'mssql://sa:test123@localhost:1433/companies_coderic'

export const createDataSource = () => {
    return new DataSource({
        type: "mssql",
        url: connectionString1,
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
        synchronize: true,
        logging: true,
        entities: [BankAccount, BankTransaction, CashRegister, CashEntry, Company, Invoice],
    });
};

// const connectionString2 = 'postgresql://postgres.hhbxehwlrsbtfwpvhuef:C0der1c123@+@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'

// export const createDataSource2 = () => {
//     return new DataSource({
//         type: "postgres",
//         url: connectionString2,
//         ssl: { rejectUnauthorized: false },
//         synchronize: true,
//         logging: true,
//         entities: [BankAccount, BankTransaction, CashRegister, CashEntry, Company, Invoice],
//     });
// };
