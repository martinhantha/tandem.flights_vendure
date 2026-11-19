import { LanguageCode, PluginCommonModule, VendurePlugin, I18nService } from "@vendure/core"
import { OnApplicationBootstrap } from "@nestjs/common"
import path from "path"

@VendurePlugin({
    compatibility: "^3.0.0",
    imports: [PluginCommonModule],
    configuration: (config) => {
        return config
    },
})
export class CustomTranslationsPlugin implements OnApplicationBootstrap {
    private readonly translationDir = path.join(__dirname, "./translations")
    private readonly languages = [LanguageCode.de, LanguageCode.it, LanguageCode.en]

    constructor(private i18nService: I18nService) {}

    onApplicationBootstrap() {
        // register translations
        this.languages.forEach((language) => {
            this.i18nService.addTranslationFile(language, path.join(this.translationDir, `/${language}.json`))
        })
    }
}
