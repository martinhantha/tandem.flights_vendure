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
        .findOneOrFail({
            where: { identifier: superadminCredentials.identifier },
            // roles + channels are needed, otherwise the context has no permissions (error.forbidden)
            relations: ['roles', 'roles.channels'],
        });
    return app.get(RequestContextService).create({
        apiType: 'admin',
        user: superAdminUser,
    });
}
