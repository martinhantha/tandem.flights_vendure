import { LanguageCode, PluginCommonModule, VendurePlugin, I18nService } from "@vendure/core"
import { OnApplicationBootstrap } from "@nestjs/common"
import path from "path"
import Handlebars from "handlebars"
import i18next from "i18next"
import timezonedDayjs from "../ht-plugin/services/dayjs"

@VendurePlugin({
    compatibility: "^3.0.0",
    imports: [PluginCommonModule],
    configuration: (config) => {
        return config
    },
})
export class CustomEmailPlugin implements OnApplicationBootstrap {
    private readonly translationDir = path.join(__dirname, "./translations")
    private readonly languages = [LanguageCode.de, LanguageCode.it, LanguageCode.en]

    constructor(private i18nService: I18nService) {}

    onApplicationBootstrap() {
        // register translations
        this.languages.forEach((language) => {
            this.i18nService.addTranslationFile(language, path.join(this.translationDir, `/${language}.json`))
        })

        // register handlebars helpers
        this.registerHelpers()
    }

    private registerHelpers() {
        Handlebars.registerHelper("splitDescription", (description) => {
            const parts = description?.split("|")
            return {
                title: (parts[0] || "").trim(),
                text: (parts[1] || "").trim(),
            }
        })
        Handlebars.registerHelper("formatDateTime", (data, languageCode) => {
            const date = data ? JSON.parse(data)?.date : ""
            return {
                dateTimeText: date ? timezonedDayjs(date).format(i18next.t("dateTimeFormat", { lng: languageCode })) + " " + i18next.t("timeSuffix", { lng: languageCode }) : "",
            }
        })
    }
}
