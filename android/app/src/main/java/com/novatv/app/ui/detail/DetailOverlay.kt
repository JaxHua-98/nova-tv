package com.novatv.app.ui.detail

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.data.MediaItem
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay

private enum class DetailTarget {
    CLOSE,
    PLAY,
    FAVORITE,
}

@Composable
fun DetailOverlay(
    item: MediaItem,
    onClose: () -> Unit,
    onPlay: () -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var focusedTarget by remember { mutableStateOf(DetailTarget.PLAY) }
    var favorite by remember(item.id) { mutableStateOf(false) }
    val requesters = remember {
        DetailTarget.values().associateWith { FocusRequester() }
    }

    fun request(target: DetailTarget) {
        runCatching { requesters.getValue(target).requestFocus() }
    }

    LaunchedEffect(item.id) {
        delay(120)
        request(DetailTarget.PLAY)
    }

    BackHandler(onBack = onClose)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF111B38))
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionDown -> {
                        if (focusedTarget == DetailTarget.CLOSE) request(DetailTarget.PLAY)
                        true
                    }

                    Key.DirectionUp -> {
                        request(DetailTarget.CLOSE)
                        true
                    }

                    Key.DirectionLeft -> {
                        when (focusedTarget) {
                            DetailTarget.FAVORITE -> request(DetailTarget.PLAY)
                            else -> Unit
                        }
                        true
                    }

                    Key.DirectionRight -> {
                        when (focusedTarget) {
                            DetailTarget.PLAY -> request(DetailTarget.FAVORITE)
                            else -> Unit
                        }
                        true
                    }

                    else -> false
                }
            },
    ) {
        Image(
            painter = painterResource(item.imageRes),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colorStops = arrayOf(
                            0f to Color(0xF5080E28),
                            0.42f to Color(0xD10A112D),
                            0.74f to Color(0x470A0F27),
                            1f to Color(0x87080C21),
                        ),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0f to Color.Transparent,
                            0.5f to Color.Transparent,
                            1f to Color(0xEB070C22),
                        ),
                    ),
                ),
        )

        CloseDetailButton(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 40.dp, end = 64.dp),
            requester = requesters.getValue(DetailTarget.CLOSE),
            onFocused = { focusedTarget = DetailTarget.CLOSE },
            onClick = onClose,
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 112.dp, bottom = 112.dp)
                .width(870.dp),
        ) {
            Text(
                text = item.type,
                color = Color.White.copy(alpha = 0.76f),
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.sp,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.09f), RoundedCornerShape(9.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.20f), RoundedCornerShape(9.dp))
                    .padding(horizontal = 11.dp, vertical = 7.dp),
            )
            Text(
                text = item.title,
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 64.sp,
                lineHeight = 64.sp,
                letterSpacing = (-3.4).sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 15.dp),
            )
            Text(
                text = item.meta,
                color = Color.White.copy(alpha = 0.57f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 16.sp,
                modifier = Modifier.padding(top = 17.dp),
            )
            Text(
                text = item.description,
                color = Color.White.copy(alpha = 0.71f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Normal,
                fontSize = 17.sp,
                lineHeight = 29.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .padding(top = 22.dp)
                    .width(710.dp),
            )
            Row(
                modifier = Modifier.padding(top = 30.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                DetailAction(
                    text = "播放测试片源",
                    icon = NovaIcons.Play,
                    primary = true,
                    requester = requesters.getValue(DetailTarget.PLAY),
                    onFocused = { focusedTarget = DetailTarget.PLAY },
                    onClick = onPlay,
                )
                DetailAction(
                    text = if (favorite) "已收藏" else "加入收藏",
                    icon = if (favorite) NovaIcons.Check else NovaIcons.Bookmark,
                    primary = false,
                    requester = requesters.getValue(DetailTarget.FAVORITE),
                    onFocused = { focusedTarget = DetailTarget.FAVORITE },
                    onClick = {
                        favorite = !favorite
                        onToast(if (favorite) "已加入收藏" else "已取消收藏")
                    },
                )
            }
            Row(
                modifier = Modifier.padding(top = 42.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(25.dp)
                        .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = NovaIcons.Headphones,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.36f),
                        modifier = Modifier.size(14.dp),
                    )
                }
                Text(
                    text = "影片信息仅用于界面演示 · 播放内容为公开授权测试片源",
                    color = Color.White.copy(alpha = 0.36f),
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
        }
    }
}

@Composable
private fun CloseDetailButton(
    modifier: Modifier,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier.size(48.dp),
        shape = RoundedCornerShape(16.dp),
        focusRequester = requester,
        focusedScale = 1.08f,
        transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f),
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.18f), RoundedCornerShape(16.dp))
                .background(Color.White.copy(alpha = if (focused) 0.15f else 0.06f), RoundedCornerShape(16.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.20f),
                    RoundedCornerShape(16.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = NovaIcons.Close,
                contentDescription = "返回首页",
                tint = NovaWhite.copy(alpha = 0.88f),
                modifier = Modifier.size(23.dp),
            )
        }
    }
}

@Composable
private fun DetailAction(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    primary: Boolean,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier.height(54.dp),
        shape = RoundedCornerShape(16.dp),
        focusRequester = requester,
        focusedScale = 1.045f,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Row(
            modifier = Modifier
                .height(54.dp)
                .background(
                    if (primary) {
                        if (focused) Color.White else Color.White.copy(alpha = 0.94f)
                    } else {
                        Color.White.copy(alpha = if (focused) 0.17f else 0.09f)
                    },
                    RoundedCornerShape(16.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = if (primary) 0f else 0.20f),
                    RoundedCornerShape(16.dp),
                )
                .padding(horizontal = 22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (primary) Color(0xFF162346) else Color.White.copy(alpha = 0.85f),
                modifier = Modifier.size(19.dp),
            )
            Text(
                text = text,
                color = if (primary) Color(0xFF162346) else Color.White.copy(alpha = 0.85f),
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                modifier = Modifier.padding(start = 9.dp),
            )
        }
    }
}
