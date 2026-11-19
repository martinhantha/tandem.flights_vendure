import { VendurePlugin, PluginCommonModule } from "@vendure/core"
import rateLimit from "express-rate-limit"
import { NestExpressApplication } from "@nestjs/platform-express"

@VendurePlugin({
    imports: [PluginCommonModule],
})
export class RateLimitPlugin {
    configure(app: any) {
        // app ist ein NestJS INestApplication
        const nestApp = app as NestExpressApplication
        const expressApp = nestApp.getHttpAdapter().getInstance()

        const shopLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 Minute
            max: 200, // 100 Requests pro Minute pro IP
            standardHeaders: true, // setzt RateLimit-Header (X-RateLimit-*)
            legacyHeaders: false, // alte Header deaktivieren
            handler: (req, res) => {
                res.status(429).send("Too many requests")
            },
        })

        const adminLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 200,
            message: "Too many admin requests, please slow down.",
        })

        expressApp.use("/shop-api", shopLimiter)
        expressApp.use("/admin-api", adminLimiter)
    }
}
