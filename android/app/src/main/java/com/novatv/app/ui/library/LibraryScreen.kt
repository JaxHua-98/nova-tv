package com.novatv.app.ui.library

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

private val categories = listOf("全部", "电影", "剧集", "动画", "综艺")

@Composable
fun LibraryScreen(
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenDetail: (MediaItem) -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val libraryItems = remember {
        listOf(
            DemoCatalog.dune,
            DemoCatalog.interstellar,
            DemoCatalog.joker,
            DemoCatalog.peaky,
            DemoCatalog.totoro,
            DemoCatalog.lostYou,
            DemoCatalog.avengers,
            DemoCatalog.yourName,
        )
    }
    var selectedCategory by remember { mutableStateOf("全部") }
    val filtered = remember(selectedCategory) {
        when (selectedCategory) {
            "全部" -> libraryItems
            "动画" -> libraryItems.filter { it.type.contains("动画") }
            "综艺" -> emptyList()
            else -> libraryItems.filter { it.type == selectedCategory }
        }
    }
    val itemRequesters = remember(libraryItems) {
        libraryItems.associate { it.id to FocusRequester() }
    }
    val firstFocus = remember(libraryItems) {
        itemRequesters.getValue(libraryItems.first().id)
    }

    LaunchedEffect(Unit) {
        delay(170)
        runCatching { firstFocus.requestFocus() }
    }

    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(start = 64.dp, top = 40.dp, end = 64.dp, bottom = 40.dp),
    ) {
        SecondaryHeader(
            eyebrow = "NOVA LIBRARY · 聚合片库",
            title = "电影 · 剧集 · 动画 · 综艺",
            onBack = onBack,
        ) {
            LibraryStatus(label = "演示片库 ${libraryItems.size}")
            Box(Modifier.width(12.dp))
            LibraryHeaderAction(onClick = onOpenSettings)
        }

        Spacer(Modifier.height(18.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            categories.forEach { category ->
                CategoryChip(
                    text = category,
                    selected = selectedCategory == category,
                    onClick = { selectedCategory = category },
                )
            }
        }

        Spacer(Modifier.height(18.dp))

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
                if (filtered.isEmpty()) {
                    EmptyLibrary(
                        category = selectedCategory,
                        onBackToAll = { selectedCategory = "全部" },
                    )
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        filtered.chunked(4).forEachIndexed { rowIndex, rowItems ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f),
                                horizontalArrangement = Arrangement.spacedBy(16.dp),
                            ) {
                                rowItems.forEachIndexed { columnIndex, item ->
                                    val index = rowIndex * 4 + columnIndex
                                    LibraryCard(
                                        item = item,
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight(),
                                        requester = itemRequesters.getValue(item.id),
                                        transformOrigin = when (columnIndex) {
                                            0 -> TransformOrigin(0f, 0.5f)
                                            3 -> TransformOrigin(1f, 0.5f)
                                            else -> TransformOrigin.Center
                                        },
                                        onClick = { onOpenDetail(item) },
                                    )
                                    if (index == libraryItems.lastIndex) Unit
                                }
                                repeat(4 - rowItems.size) {
                                    Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                        repeat(2 - filtered.chunked(4).size) {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

            NovaGlassPanel(
                modifier = Modifier
                    .width(410.dp)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                LibrarySidePanel(
                    selectedCategory = selectedCategory,
                    itemCount = filtered.size,
                    onOpenSettings = onOpenSettings,
                    onToast = onToast,
                )
            }
        }
    }
}

@Composable
private fun LibraryCard(
    item: MediaItem,
    modifier: Modifier,
    requester: FocusRequester,
    transformOrigin: TransformOrigin,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        focusRequester = requester,
        focusedScale = 1.022f,
        transformOrigin = transformOrigin,
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0x55162252), RoundedCornerShape(22.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.14f),
                    RoundedCornerShape(22.dp),
                ),
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
                        Brush.verticalGradient(
                            listOf(Color(0x10101840), Color(0x1A101838), Color(0xD90D112D)),
                        ),
                    ),
            )
            Text(
                text = item.type,
                color = NovaWhite.copy(alpha = 0.78f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 10.sp,
                modifier = Modifier
                    .padding(13.dp)
                    .background(Color.Black.copy(alpha = 0.22f), RoundedCornerShape(8.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.13f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 8.dp, vertical = 5.dp),
            )
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(15.dp),
            ) {
                Text(
                    text = item.title,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 19.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = item.meta,
                    color = Color.White.copy(alpha = 0.52f),
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
        }
    }
}

@Composable
private fun CategoryChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier.height(38.dp),
        shape = RoundedCornerShape(13.dp),
        focusedScale = 1.05f,
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .background(
                    if (selected) Color.White.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.055f),
                    RoundedCornerShape(13.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.12f),
                    RoundedCornerShape(13.dp),
                )
                .padding(horizontal = 17.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                color = if (selected || focused) NovaWhite else Color.White.copy(alpha = 0.54f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.5.sp,
            )
        }
    }
}

@Composable
private fun LibrarySidePanel(
    selectedCategory: String,
    itemCount: Int,
    onOpenSettings: () -> Unit,
    onToast: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(26.dp),
    ) {
        Text(
            text = "片库概览",
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 25.sp,
        )
        Text(
            text = "当前分类 · $selectedCategory",
            color = Color.White.copy(alpha = 0.47f),
            fontFamily = Manrope,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 5.dp),
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 22.dp)
                .height(176.dp)
                .background(
                    Brush.linearGradient(listOf(Color(0x8A8B6DE9), Color(0x752F8FB9))),
                    RoundedCornerShape(23.dp),
                )
                .border(1.dp, Color.White.copy(alpha = 0.17f), RoundedCornerShape(23.dp)),
        ) {
            Icon(
                imageVector = NovaIcons.Movie,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.78f),
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(58.dp),
            )
            Text(
                text = "$itemCount 部内容",
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp),
            )
        }

        Text(
            text = "已接入的基础能力",
            color = Color.White.copy(alpha = 0.60f),
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 24.dp),
        )
        listOf(
            "本地分类与聚合卡片",
            "统一详情页与收藏入口",
            "片源配置由设置页管理",
            "观看进度写入最近观看",
        ).forEach { label ->
            Row(
                modifier = Modifier.padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .background(NovaMint.copy(alpha = 0.13f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = NovaIcons.Check,
                        contentDescription = null,
                        tint = NovaMint,
                        modifier = Modifier.size(13.dp),
                    )
                }
                Text(
                    text = label,
                    color = Color.White.copy(alpha = 0.53f),
                    fontFamily = Manrope,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(start = 9.dp),
                )
            }
        }

        Spacer(Modifier.weight(1f))
        SideAction(text = "内容源管理", onClick = onOpenSettings)
        Spacer(Modifier.height(10.dp))
        SideAction(
            text = "刷新演示数据",
            onClick = { onToast("演示片库已是最新状态") },
        )
    }
}

@Composable
private fun SideAction(text: String, onClick: () -> Unit) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(15.dp),
        focusedScale = 1.02f,
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.15f else 0.065f), RoundedCornerShape(15.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.12f),
                    RoundedCornerShape(15.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                color = NovaWhite.copy(alpha = 0.76f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun EmptyLibrary(category: String, onBackToAll: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = NovaIcons.Movie,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.28f),
                modifier = Modifier.size(50.dp),
            )
            Text(
                text = "$category 分类暂无演示内容",
                color = NovaWhite.copy(alpha = 0.82f),
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp,
                modifier = Modifier.padding(top = 16.dp),
            )
            NovaFocusable(
                modifier = Modifier
                    .padding(top = 18.dp)
                    .height(44.dp),
                shape = RoundedCornerShape(14.dp),
                onClick = onBackToAll,
            ) { focused ->
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .background(Color.White.copy(alpha = if (focused) 0.16f else 0.08f), RoundedCornerShape(14.dp))
                        .border(
                            if (focused) 2.dp else 1.dp,
                            if (focused) NovaWhite else Color.White.copy(alpha = 0.13f),
                            RoundedCornerShape(14.dp),
                        )
                        .padding(horizontal = 18.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "返回全部",
                        color = NovaWhite.copy(alpha = 0.78f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun LibraryStatus(label: String) {
    Row(
        modifier = Modifier
            .background(Color.White.copy(alpha = 0.07f), RoundedCornerShape(12.dp))
            .border(1.dp, Color.White.copy(alpha = 0.11f), RoundedCornerShape(12.dp))
            .padding(horizontal = 13.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).background(NovaMint, CircleShape))
        Text(
            text = label,
            color = Color.White.copy(alpha = 0.62f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

@Composable
private fun LibraryHeaderAction(onClick: () -> Unit) {
    NovaFocusable(
        modifier = Modifier.height(42.dp),
        shape = RoundedCornerShape(14.dp),
        focusedScale = 1.05f,
        transformOrigin = TransformOrigin(1f, 0.5f),
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .background(Color.White.copy(alpha = if (focused) 0.16f else 0.07f), RoundedCornerShape(14.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.14f),
                    RoundedCornerShape(14.dp),
                )
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = NovaIcons.Tune,
                contentDescription = null,
                tint = NovaWhite.copy(alpha = 0.80f),
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = "内容源",
                color = NovaWhite.copy(alpha = 0.76f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 11.5.sp,
                modifier = Modifier.padding(start = 7.dp),
            )
        }
    }
}
