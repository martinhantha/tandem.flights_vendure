import { INestApplicationContext } from '@nestjs/common';
import { ConfigService, RequestContext, RequestContextService, TransactionalConnection, User } from '@vendure/core';

/**
 * Creates a RequestContext configured for the default Channel with the activeUser set
 * as the superadmin user.
 */
export async function getSuperadminContext(app: INestApplicationContext): Promise<RequestContext> {
    const { superadminCredentials } = app.get(ConfigService).authOptions;
    const superAdminUser = await app
        .get(TransactionalConnection)
        .getRepository(User)
        .findOneOrFail({ where: { identifier: superadminCredentials.identifier } });
    return app.get(RequestContextService).create({
        apiType: 'admin',
        user: superAdminUser,
    });
}
