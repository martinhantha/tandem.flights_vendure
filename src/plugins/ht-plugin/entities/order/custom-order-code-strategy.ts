import { Injectable } from '@nestjs/common';
import { OrderCodeStrategy, VendureEntityEvent, TransactionalConnection, RequestContext, Injector } from '@vendure/core';

@Injectable()
export class CustomOrderCodeStrategy implements OrderCodeStrategy {

    private connection: TransactionalConnection;

    init(injector: Injector) {
        this.connection = injector.get(TransactionalConnection);
    }

    async generate(ctx: RequestContext) {
        // Use a dedicated queryRunner/connection so we can safely read back
        // the incremented value in a concurrency-safe way.
        const queryRunner = this.connection.rawConnection.createQueryRunner();
        await queryRunner.connect();

        try {
            let newValue: number | string | undefined;

            const result = await queryRunner.query(`
                    INSERT INTO order_counter (id, "currentValue")
                    VALUES (1, 1)
                    ON CONFLICT (id) DO UPDATE
                    SET "currentValue" = order_counter."currentValue" + 1
                    RETURNING "currentValue" as "currentValue"
                `);
            newValue = result?.[0]?.currentValue;

            return `XX-${String(newValue).padStart(8, '0')}`;
        } finally {
            await queryRunner.release();
        }

        // TODO: Implement for other DBs
        // try {
        //     const dbType = (this.connection.rawConnection.options as any)?.type as string | undefined;

        //     let newValue: number | string | undefined;

        //     if (dbType === 'postgres') {
        //         const result = await queryRunner.query(`
        //             INSERT INTO order_counter (id, "currentValue")
        //             VALUES (1, 1)
        //             ON CONFLICT (id) DO UPDATE
        //             SET "currentValue" = order_counter."currentValue" + 1
        //             RETURNING "currentValue" as "currentValue"
        //         `);
        //         newValue = result?.[0]?.currentValue;
        //     } else if (dbType === 'mysql' || dbType === 'mariadb') {
        //         await queryRunner.query(`
        //             INSERT INTO order_counter (id, currentValue)
        //             VALUES (1, LAST_INSERT_ID(1))
        //             ON DUPLICATE KEY UPDATE currentValue = LAST_INSERT_ID(currentValue + 1)
        //         `);
        //         const result = await queryRunner.query(`SELECT LAST_INSERT_ID() as currentValue`);
        //         newValue = result?.[0]?.currentValue;
        //     } else {
        //         await queryRunner.query(`INSERT INTO order_counter (id, "currentValue") VALUES (1, 0) ON CONFLICT (id) DO NOTHING`);
        //         await queryRunner.query(`UPDATE order_counter SET "currentValue" = "currentValue" + 1 WHERE id = 1`);
        //         const result = await queryRunner.query(`SELECT "currentValue" as "currentValue" FROM order_counter WHERE id = 1`);
        //         newValue = result?.[0]?.currentValue;
        //     }

        //     return `XX-${String(newValue).padStart(8, '0')}`;
        // } finally {
        //     await queryRunner.release();
        // }
    }
}
