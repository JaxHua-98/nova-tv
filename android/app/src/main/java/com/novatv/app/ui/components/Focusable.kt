package com.novatv.app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaWhite

@Composable
fun NovaFocusable(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(24.dp),
    focusRequester: FocusRequester = remember { FocusRequester() },
    focusedScale: Float = 1.025f,
    transformOrigin: TransformOrigin = TransformOrigin.Center,
    onClick: () -> Unit,
    onFocusChanged: (Boolean) -> Unit = {},
    content: @Composable BoxScope.(focused: Boolean) -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (focused) focusedScale else 1f,
        animationSpec = spring(dampingRatio = 0.78f, stiffness = 520f),
        label = "focus-scale",
    )
    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                this.transformOrigin = transformOrigin
            }
            .shadow(
                elevation = if (focused) 22.dp else 9.dp,
                shape = shape,
                clip = false,
                ambientColor = if (focused) Color.White.copy(alpha = 0.48f) else Color(0x33101A5D),
                spotColor = if (focused) Color.White.copy(alpha = 0.42f) else Color(0x44101A5D),
            )
            .focusRequester(focusRequester)
            .onFocusChanged {
                if (focused != it.isFocused) {
                    focused = it.isFocused
                    onFocusChanged(it.isFocused)
                }
            }
            .clip(shape)
            .onPreviewKeyEvent { event ->
                if (
                    event.type == KeyEventType.KeyDown &&
                    (event.key == Key.Enter ||
                        event.key == Key.NumPadEnter ||
                        event.key == Key.DirectionCenter)
                ) {
                    onClick()
                    true
                } else {
                    false
                }
            }
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClick = onClick,
            ),
        content = { content(focused) },
    )
}

@Composable
fun NovaActionButton(
    text: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    primary: Boolean = true,
    focusRequester: FocusRequester = remember { FocusRequester() },
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(50)
    NovaFocusable(
        modifier = modifier,
        shape = shape,
        focusRequester = focusRequester,
        focusedScale = 1.035f,
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .background(
                    brush = if (primary) {
                        Brush.horizontalGradient(
                            listOf(Color(0xFFF5F7FF), Color(0xFFDDE7FF)),
                        )
                    } else {
                        Brush.horizontalGradient(
                            listOf(Color.White.copy(alpha = 0.17f), Color.White.copy(alpha = 0.08f)),
                        )
                    },
                )
                .border(
                    width = if (focused) 2.dp else 1.dp,
                    color = if (focused) NovaWhite else Color.White.copy(alpha = 0.23f),
                    shape = shape,
                )
                .padding(horizontal = 25.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (primary) Color(0xFF23345E) else NovaWhite,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = text,
                color = if (primary) Color(0xFF23345E) else NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                modifier = Modifier.padding(start = 9.dp),
            )
        }
    }
}

@Composable
fun NovaIconButton(
    icon: ImageVector,
    contentDescription: String,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester = remember { FocusRequester() },
    onFocusChanged: (Boolean) -> Unit = {},
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier.size(46.dp),
        shape = RoundedCornerShape(15.dp),
        focusRequester = focusRequester,
        focusedScale = 1.08f,
        onClick = onClick,
        onFocusChanged = onFocusChanged,
    ) { focused ->
        Box(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.15f), Color.White.copy(alpha = 0.055f)),
                    ),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.18f),
                    RoundedCornerShape(15.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = NovaWhite,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

@Composable
fun FocusOutline(
    focused: Boolean,
    shape: Shape,
    cornerWidth: Dp = 2.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = Modifier
            .border(
                width = cornerWidth,
                color = if (focused) NovaWhite else Color.Transparent,
                shape = shape,
            ),
        content = content,
    )
}
