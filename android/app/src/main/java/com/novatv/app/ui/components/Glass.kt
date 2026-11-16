package com.novatv.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.novatv.app.ui.theme.NovaGlassBottom
import com.novatv.app.ui.theme.NovaGlassDeep
import com.novatv.app.ui.theme.NovaGlassTop
import com.novatv.app.ui.theme.NovaLightLine

@Composable
fun NovaGlassPanel(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(30.dp),
    borderColor: Color = NovaLightLine,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .shadow(
                elevation = 26.dp,
                shape = shape,
                clip = false,
                ambientColor = Color(0x44101A5D),
                spotColor = Color(0x55101A5D),
            )
            .clip(shape)
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color.White.copy(alpha = 0.15f),
                        NovaGlassDeep,
                        Color(0x1F14245E),
                    ),
                ),
            )
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(NovaGlassTop, NovaGlassBottom),
                ),
            )
            .border(1.dp, borderColor, shape),
        content = content,
    )
}

fun Modifier.glassCard(
    shape: Shape,
    topAlpha: Float = 0.16f,
    bottomAlpha: Float = 0.055f,
    borderWidth: Dp = 1.dp,
    borderColor: Color = NovaLightLine,
): Modifier = this
    .clip(shape)
    .background(
        brush = Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = topAlpha),
                Color.White.copy(alpha = bottomAlpha),
            ),
        ),
    )
    .border(borderWidth, borderColor, shape)
