package com.novatv.app.ui.saved

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.data.DemoCatalog
import com.novatv.app.data.MediaItem
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaGlassPanel
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.components.SecondaryHeader
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaMint
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay

private enum class SavedTab(val label: String) {
    HISTORY("观看历史"),
    FAVORITES("我的收藏"),
}

@Composable
fun SavedScreen(
    onBack: () -> Unit,
    onOpenDetail: (MediaItem) -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var tab by remember { mutableStateOf(SavedTab.HISTORY) }
    val items = remember(tab) {
        when (tab) {
            SavedTab.HISTORY -> DemoCatalog.recent
            SavedTab.FAVORITES -> listOf(DemoCatalog.dune, DemoCatalog.yourName, DemoCatalog.totoro)
        }
    }
    val itemRequesters = remember(items) {
        items.associate { it.id to FocusRequester() }
    }

    LaunchedEffect(tab, itemRequesters) {
        delay(100)
        runCatching { itemRequesters.getValue(items.first().id).requestFocus() }
    }

    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(start = 64.dp, top = 40.dp, end = 64.dp, bottom = 40.dp),
    ) {
        SecondaryHeader(
            eyebrow = "NOVA PERSONAL · 个人片单",
            title = "收藏与观看历史",
            onBack = onBack,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SavedTab.values().forEach { entry ->
                    TabChip(
                        text = entry.label,
                        selected = tab == entry,
                        onClick = { tab = entry },
                    )
                }
            }
        }

        Spacer(Modifier.height(22.dp))

        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            NovaGlassPanel(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(26.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text(
                                text = tab.label,
                                color = NovaWhite,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 27.sp,
                            )
                            Text(
                                text = if (tab == SavedTab.HISTORY) {
                                    "按最近播放时间排序 · 本机演示数据"
                                } else {
                                    "跨片源统一收藏 · 本机演示数据"
                                },
                                color = Color.White.copy(alpha = 0.47f),
                                fontFamily = Manrope,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 5.dp),
                            )
                        }
                        Text(
                            text = "${items.size} 项",
                            color = Color.White.copy(alpha = 0.43f),
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Medium,
                            fontSize = 11.sp,
                            modifier = Modifier
                                .background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(11.dp))
                                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(11.dp))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }

                    Spacer(Modifier.height(22.dp))

                    items.forEachIndexed { index, item ->
                        SavedMediaRow(
                            item = item,
                            index = index,
                            showProgress = tab == SavedTab.HISTORY,
                            requester = itemRequesters.getValue(item.id),
                            onClick = { onOpenDetail(item) },
                        )
                        if (index < items.lastIndex) {
                            Spacer(Modifier.height(12.dp))
                        }
                    }

                    Spacer(Modifier.weight(1f))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.045f), RoundedCornerShape(18.dp))
                            .border(1.dp, Color.White.copy(alpha = 0.09f), RoundedCornerShape(18.dp))
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = NovaIcons.Clock,
                            contentDescription = null,
                            tint = NovaMint,
                            modifier = Modifier.size(24.dp),
                        )
                        Text(
                            text = "本轮使用本地演示数据；Room 持久化会在下一阶段接入。",
                            color = Color.White.copy(alpha = 0.45f),
                            fontFamily = Manrope,
                            fontSize = 11.5.sp,
                            modifier = Modifier.padding(start = 12.dp),
                        )
                    }
                }
            }

            NovaGlassPanel(
                modifier = Modifier
                    .width(408.dp)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                PersonalSummary(
                    historyCount = DemoCatalog.recent.size,
                    favoriteCount = 3,
                    onToast = onToast,
                )
            }
        }
    }
}

@Composable
private fun TabChip(text: String, selected: Boolean, onClick: () -> Unit) {
    NovaFocusable(
        modifier = Modifier.height(42.dp),
        shape = RoundedCornerShape(14.dp),
        focusedScale = 1.05f,
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .background(
                    if (selected) Color.White.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.06f),
                    RoundedCornerShape(14.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.12f),
                    RoundedCornerShape(14.dp),
                )
                .padding(horizontal = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                color = if (selected || focused) NovaWhite else Color.White.copy(alpha = 0.53f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun SavedMediaRow(
    item: MediaItem,
    index: Int,
    showProgress: Boolean,
    requester: FocusRequester,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(154.dp),
        shape = RoundedCornerShape(22.dp),
        focusRequester = requester,
        focusedScale = 1.018f,
        transformOrigin = TransformOrigin(0f, 0.5f),
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.11f else 0.043f), RoundedCornerShape(22.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.09f),
                    RoundedCornerShape(22.dp),
                )
                .padding(10.dp),
        ) {
            Image(
                painter = painterResource(item.imageRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .width(218.dp)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(15.dp)),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(start = 18.dp, end = 10.dp, top = 8.dp, bottom = 8.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.type,
                        color = NovaWhite.copy(alpha = 0.68f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Medium,
                        fontSize = 10.sp,
                        modifier = Modifier
                            .background(Color.White.copy(alpha = 0.07f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 5.dp),
                    )
                    Text(
                        text = when {
                            showProgress -> "继续观看"
                            index == 0 -> "最近收藏"
                            else -> "已收藏"
                        },
                        color = Color.White.copy(alpha = 0.40f),
                        fontFamily = Manrope,
                        fontSize = 10.5.sp,
                        modifier = Modifier.padding(start = 9.dp),
                    )
                }
                Text(
                    text = item.title,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 23.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 9.dp),
                )
                Text(
                    text = item.meta,
                    color = Color.White.copy(alpha = 0.46f),
                    fontFamily = Manrope,
                    fontSize = 11.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 6.dp),
                )
                if (showProgress) {
                    Row(
                        modifier = Modifier.padding(top = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(5.dp)
                                .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(50)),
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(item.progress)
                                    .fillMaxHeight()
                                    .background(
                                        Brush.horizontalGradient(listOf(NovaMint, Color(0xFFF2FBFF))),
                                        RoundedCornerShape(50),
                                    ),
                            )
                        }
                        Text(
                            text = item.progressLabel.orEmpty(),
                            color = Color.White.copy(alpha = 0.46f),
                            fontFamily = Manrope,
                            fontSize = 10.5.sp,
                            modifier = Modifier.padding(start = 12.dp),
                        )
                    }
                }
            }
            Box(
                modifier = Modifier
                    .align(Alignment.CenterVertically)
                    .size(38.dp)
                    .background(Color.White.copy(alpha = 0.06f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = NovaIcons.ChevronRight,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.50f),
                    modifier = Modifier.size(22.dp),
                )
            }
        }
    }
}

@Composable
private fun PersonalSummary(
    historyCount: Int,
    favoriteCount: Int,
    onToast: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(26.dp),
    ) {
        Text(
            text = "我的 NOVA",
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp,
        )
        Text(
            text = "跨影视、直播与音乐的本地个人空间",
            color = Color.White.copy(alpha = 0.47f),
            fontFamily = Manrope,
            fontSize = 11.5.sp,
            lineHeight = 18.sp,
            modifier = Modifier.padding(top = 6.dp),
        )

        Row(
            modifier = Modifier.padding(top = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(value = "$historyCount", label = "观看记录", modifier = Modifier.weight(1f))
            StatCard(value = "$favoriteCount", label = "收藏内容", modifier = Modifier.weight(1f))
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 20.dp)
                .height(210.dp)
                .background(
                    Brush.linearGradient(listOf(Color(0x82786BE7), Color(0x5A2D9FBE))),
                    RoundedCornerShape(23.dp),
                )
                .border(1.dp, Color.White.copy(alpha = 0.16f), RoundedCornerShape(23.dp)),
        ) {
            Icon(
                imageVector = NovaIcons.Bookmark,
                contentDescription = null,
                tint = NovaWhite.copy(alpha = 0.80f),
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(60.dp),
            )
            Text(
                text = "收藏与历史会在 TV、盒子\n之间保持同一份本地数据结构",
                color = Color.White.copy(alpha = 0.74f),
                fontFamily = Manrope,
                fontSize = 12.sp,
                lineHeight = 19.sp,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(17.dp),
            )
        }

        Spacer(Modifier.weight(1f))

        SummaryAction(text = "清理观看记录", onClick = { onToast("演示数据已保留，清理功能将在接入 Room 后启用") })
        Spacer(Modifier.height(10.dp))
        SummaryAction(text = "导出个人片单", onClick = { onToast("片单导出将在个人数据层接入后启用") })
    }
}

@Composable
private fun StatCard(value: String, label: String, modifier: Modifier) {
    Column(
        modifier = modifier
            .background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(18.dp))
            .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(18.dp))
            .padding(16.dp),
    ) {
        Text(
            text = value,
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 31.sp,
        )
        Text(
            text = label,
            color = Color.White.copy(alpha = 0.46f),
            fontFamily = Manrope,
            fontSize = 11.sp,
            modifier = Modifier.padding(top = 3.dp),
        )
    }
}

@Composable
private fun SummaryAction(text: String, onClick: () -> Unit) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(15.dp),
        focusedScale = 1.015f,
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.15f else 0.06f), RoundedCornerShape(15.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.11f),
                    RoundedCornerShape(15.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                color = Color.White.copy(alpha = 0.74f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
            )
        }
    }
}
