package com.novatv.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.novatv.app.ui.theme.NovaBackgroundEnd
import com.novatv.app.ui.theme.NovaBackgroundMidA
import com.novatv.app.ui.theme.NovaBackgroundMidB
import com.novatv.app.ui.theme.NovaBackgroundMidC
import com.novatv.app.ui.theme.NovaBackgroundStart

@Composable
fun NovaBackground(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "nova-ambient")
    val phaseA by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(28_000),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "ambient-a",
    )
    val phaseB by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(34_000),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "ambient-b",
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    NovaBackgroundStart,
                    NovaBackgroundMidA,
                    NovaBackgroundMidB,
                    NovaBackgroundMidC,
                    NovaBackgroundEnd,
                ),
                start = Offset.Zero,
                end = Offset(size.width, size.height * 0.74f),
            ),
        )

        fun glow(
            center: Offset,
            radius: Float,
            inner: Color,
            middle: Color,
            blendMode: BlendMode = BlendMode.Screen,
        ) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(inner, middle, Color.Transparent),
                    center = center,
                    radius = radius,
                ),
                radius = radius,
                center = center,
                blendMode = blendMode,
            )
        }

        val driftA = (phaseA - 0.5f) * size.width * 0.05f
        val driftB = (phaseB - 0.5f) * size.width * 0.04f

        glow(
            center = Offset(size.width * 0.05f + driftA, size.height * 0.31f),
            radius = size.width * 0.29f,
            inner = Color(0xCCFFAD68),
            middle = Color(0x55FF6D9D),
        )
        glow(
            center = Offset(size.width * 0.37f + driftB, size.height * 0.37f),
            radius = size.width * 0.30f,
            inner = Color(0xAA9C70E7),
            middle = Color(0x556F6FE1),
        )
        glow(
            center = Offset(size.width * 0.69f - driftA, size.height * 0.24f),
            radius = size.width * 0.28f,
            inner = Color(0x939371E9),
            middle = Color(0x425C6FDC),
        )
        glow(
            center = Offset(size.width * 0.98f - driftB, size.height * 0.48f),
            radius = size.width * 0.33f,
            inner = Color(0xC74FC7E2),
            middle = Color(0x5B2E7FD9),
        )
        glow(
            center = Offset(size.width * 0.58f, size.height * 1.08f),
            radius = size.width * 0.36f,
            inner = Color(0x3DFFB3D8),
            middle = Color(0x157E68D9),
        )

        drawRect(
            brush = Brush.verticalGradient(
                colorStops = arrayOf(
                    0f to Color.White.copy(alpha = 0.06f),
                    0.24f to Color.Transparent,
                    0.72f to Color(0x14112965),
                    1f to Color(0x3D081A49),
                ),
            ),
        )

        val ribbon1 = Path().apply {
            moveTo(-size.width * 0.04f, size.height * 0.78f)
            cubicTo(
                size.width * 0.15f,
                size.height * 0.48f,
                size.width * 0.39f,
                size.height * 0.48f,
                size.width * 0.58f,
                size.height * 0.65f,
            )
            cubicTo(
                size.width * 0.76f,
                size.height * 0.80f,
                size.width * 0.88f,
                size.height * 0.54f,
                size.width * 1.04f,
                size.height * 0.28f,
            )
        }
        val ribbon2 = Path().apply {
            moveTo(-size.width * 0.04f, size.height * 0.50f)
            cubicTo(
                size.width * 0.22f,
                size.height * 0.40f,
                size.width * 0.35f,
                size.height * 0.64f,
                size.width * 0.58f,
                size.height * 0.52f,
            )
            cubicTo(
                size.width * 0.77f,
                size.height * 0.42f,
                size.width * 0.87f,
                size.height * 0.28f,
                size.width * 1.04f,
                size.height * 0.38f,
            )
        }
        val ribbon3 = Path().apply {
            moveTo(-size.width * 0.02f, size.height * 0.91f)
            cubicTo(
                size.width * 0.22f,
                size.height * 0.74f,
                size.width * 0.44f,
                size.height * 0.89f,
                size.width * 0.66f,
                size.height * 0.82f,
            )
            cubicTo(
                size.width * 0.82f,
                size.height * 0.77f,
                size.width * 0.91f,
                size.height * 0.65f,
                size.width * 1.03f,
                size.height * 0.67f,
            )
        }

        drawPath(
            path = ribbon1,
            color = Color.White.copy(alpha = 0.15f),
            style = Stroke(width = 1.25.dp.toPx(), cap = StrokeCap.Round),
        )
        drawPath(
            path = ribbon2,
            color = Color(0xFFFFDAF7).copy(alpha = 0.10f),
            style = Stroke(width = 1.dp.toPx(), cap = StrokeCap.Round),
        )
        drawPath(
            path = ribbon3,
            color = Color(0xFFB7F3FF).copy(alpha = 0.12f),
            style = Stroke(width = 1.1.dp.toPx(), cap = StrokeCap.Round),
        )

        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(Color.Transparent, Color(0x45172770)),
                center = Offset(size.width / 2f, size.height / 2f),
                radius = size.maxDimension * 0.72f,
            ),
            topLeft = Offset.Zero,
            size = Size(size.width, size.height),
        )
    }
}
