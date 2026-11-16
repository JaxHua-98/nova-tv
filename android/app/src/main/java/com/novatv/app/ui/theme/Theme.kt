package com.novatv.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val NovaColorScheme = darkColorScheme(
    primary = NovaBackgroundMidB,
    onPrimary = NovaWhite,
    secondary = NovaMint,
    onSecondary = NovaDeepSpace,
    background = NovaDeepSpace,
    onBackground = NovaWhite,
    surface = NovaGlassDeep,
    onSurface = NovaWhite,
    error = NovaAlert,
)

@Composable
fun NovaTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = NovaColorScheme,
        typography = NovaTypography,
        content = content,
    )
}
