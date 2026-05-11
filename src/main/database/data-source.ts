import { DataSource } from "typeorm";
import path from "path";

export const createDataSource = (dbPath: string) =>
    new DataSource({
        type: "sqlite",
        database: dbPath,
        entities: [path.join(__dirname, "entities/*.js")],
        synchronize: true,
    });