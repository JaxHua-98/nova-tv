package com.novatv.app.ui.search

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.data.DemoCatalog
import com.novatv.app.data.MediaItem
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaGlassPanel
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay

private enum class SearchTarget {
    CLOSE,
    INPUT,
    CHIP_1,
    CHIP_2,
    CHIP_3,
    CHIP_4,
    RESULT_1,
    RESULT_2,
    RESULT_3,
    RESULT_4,
    RESULT_5,
    RESULT_6,
}

@Composable
fun SearchOverlay(
    onClose: () -> Unit,
    onOpenResult: (MediaItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    var query by remember { mutableStateOf("") }
    var focusedTarget by remember { mutableStateOf(SearchTarget.INPUT) }
    val results = remember(query) { DemoCatalog.search(query).take(6) }
    val requesters = remember {
        SearchTarget.values().associateWith { FocusRequester() }
    }

    fun request(target: SearchTarget) {
        runCatching { requesters.getValue(target).requestFocus() }
    }

    fun firstResultTarget(): SearchTarget? = if (results.isEmpty()) null else SearchTarget.RESULT_1

    LaunchedEffect(Unit) {
        delay(120)
        request(SearchTarget.INPUT)
    }

    BackHandler(onBack = onClose)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        Color(0x557961DD),
                        Color(0xB5081030),
                        Color(0xDA081134),
                    ),
                    center = androidx.compose.ui.geometry.Offset(864f, 302f),
                    radius = 1050f,
                ),
            )
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false

                if (event.key == Key.Enter || event.key == Key.NumPadEnter || event.key == Key.DirectionCenter) {
                    if (focusedTarget == SearchTarget.INPUT) {
                        val first = results.firstOrNull() ?: return@onPreviewKeyEvent false
                        onOpenResult(first)
                        return@onPreviewKeyEvent true
                    }
                    return@onPreviewKeyEvent false
                }

                when (focusedTarget) {
                    SearchTarget.CLOSE -> when (event.key) {
                        Key.DirectionDown -> request(SearchTarget.INPUT)
                        else -> Unit
                    }

                    SearchTarget.INPUT -> when (event.key) {
                        Key.DirectionUp -> request(SearchTarget.CLOSE)
                        Key.DirectionDown -> firstResultTarget()?.let(::request)
                        else -> return@onPreviewKeyEvent false
                    }

                    SearchTarget.CHIP_1,
                    SearchTarget.CHIP_2,
                    SearchTarget.CHIP_3,
                    SearchTarget.CHIP_4,
                    -> {
                        val chipIndex = focusedTarget.ordinal - SearchTarget.CHIP_1.ordinal
                        when (event.key) {
                            Key.DirectionLeft -> if (chipIndex > 0) {
                                request(SearchTarget.values()[SearchTarget.CHIP_1.ordinal + chipIndex - 1])
                            }

                            Key.DirectionRight -> if (chipIndex < 3) {
                                request(SearchTarget.values()[SearchTarget.CHIP_1.ordinal + chipIndex + 1])
                            }

                            Key.DirectionUp -> request(SearchTarget.INPUT)
                            Key.DirectionDown -> firstResultTarget()?.let(::request)
                            else -> return@onPreviewKeyEvent false
                        }
                    }

                    else -> {
                        val resultIndex = focusedTarget.ordinal - SearchTarget.RESULT_1.ordinal
                        when (event.key) {
                            Key.DirectionUp -> {
                                if (resultIndex == 0) request(SearchTarget.CHIP_1)
                                else request(SearchTarget.values()[focusedTarget.ordinal - 1])
                            }

                            Key.DirectionDown -> {
                                if (resultIndex < results.lastIndex) {
                                    request(SearchTarget.values()[focusedTarget.ordinal + 1])
                                }
                            }

                            Key.DirectionLeft -> request(SearchTarget.CLOSE)
                            else -> return@onPreviewKeyEvent false
                        }
                    }
                }
                true
            },
        contentAlignment = Alignment.TopCenter,
    ) {
        NovaGlassPanel(
            modifier = Modifier
                .padding(top = 70.dp)
                .width(1132.dp)
                .height(884.dp),
            shape = RoundedCornerShape(36.dp),
            borderColor = Color.White.copy(alpha = 0.28f),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(start = 36.dp, end = 36.dp, top = 32.dp, bottom = 24.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            text = "NOVA SEARCH",
                            color = Color.White.copy(alpha = 0.45f),
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            letterSpacing = 2.sp,
                        )
                        Text(
                            text = "搜索你今晚想看的内容",
                            color = NovaWhite,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 33.sp,
                            letterSpacing = (-1.1).sp,
                            modifier = Modifier.padding(top = 9.dp),
                        )
                    }
                    CloseButton(
                        requester = requesters.getValue(SearchTarget.CLOSE),
                        onFocused = { focusedTarget = SearchTarget.CLOSE },
                        onClick = onClose,
                    )
                }

                SearchInput(
                    query = query,
                    onQueryChange = { query = it },
                    requester = requesters.getValue(SearchTarget.INPUT),
                    onFocused = { focusedTarget = SearchTarget.INPUT },
                    onSubmit = { results.firstOrNull()?.let(onOpenResult) },
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(36.dp)
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    val chips = listOf("星际穿越", "央视", "音乐", "诺兰")
                    chips.forEachIndexed { index, label ->
                        val target = SearchTarget.values()[SearchTarget.CHIP_1.ordinal + index]
                        SuggestionChip(
                            text = label,
                            requester = requesters.getValue(target),
                            onFocused = { focusedTarget = target },
                            onClick = { query = label },
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(36.dp)
                        .padding(top = 19.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = if (query.isBlank()) "推荐内容" else "“$query” 的结果",
                        color = Color.White.copy(alpha = 0.66f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Medium,
                        fontSize = 13.sp,
                    )
                    Text(
                        text = "${results.size} 个结果",
                        color = Color.White.copy(alpha = 0.38f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Medium,
                        fontSize = 11.sp,
                    )
                }

                Spacer(Modifier.height(4.dp))

                if (results.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = NovaIcons.Search,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.30f),
                                modifier = Modifier.size(34.dp),
                            )
                            Text(
                                text = "没有找到相关内容",
                                color = NovaWhite,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 18.sp,
                                modifier = Modifier.padding(top = 14.dp),
                            )
                            Text(
                                text = "试试片名、演员、频道名或更短的关键词",
                                color = Color.White.copy(alpha = 0.46f),
                                fontFamily = Manrope,
                                fontSize = 14.sp,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(515.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        results.forEachIndexed { index, item ->
                            val target = SearchTarget.values()[SearchTarget.RESULT_1.ordinal + index]
                            SearchResultRow(
                                item = item,
                                requester = requesters.getValue(target),
                                onFocused = { focusedTarget = target },
                                onClick = { onOpenResult(item) },
                            )
                        }
                    }
                }

                Text(
                    text = "方向键选择   ·   Enter 打开   ·   Back 返回",
                    color = Color.White.copy(alpha = 0.30f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                    letterSpacing = 0.4.sp,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
        }
    }
}

@Composable
private fun CloseButton(
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier.size(48.dp),
        shape = RoundedCornerShape(16.dp),
        focusRequester = requester,
        focusedScale = 1.08f,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.16f else 0.065f), RoundedCornerShape(16.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.20f),
                    RoundedCornerShape(16.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = NovaIcons.Close,
                contentDescription = "关闭搜索",
                tint = NovaWhite.copy(alpha = 0.88f),
                modifier = Modifier.size(23.dp),
            )
        }
    }
}

@Composable
private fun SearchInput(
    query: String,
    onQueryChange: (String) -> Unit,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onSubmit: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }

    BasicTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 30.dp)
            .height(78.dp)
            .focusRequester(requester)
            .onFocusChanged {
                focused = it.isFocused
                if (it.isFocused) onFocused()
            },
        singleLine = true,
        textStyle = TextStyle(
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.Normal,
            fontSize = 24.sp,
        ),
        cursorBrush = SolidColor(NovaWhite),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
        decorationBox = { innerTextField ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(23.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0x573A77D5), Color(0x365E66D1)),
                        ),
                    )
                    .background(Color.White.copy(alpha = 0.06f))
                    .border(
                        if (focused) 2.dp else 1.dp,
                        if (focused) NovaWhite.copy(alpha = 0.94f) else Color.White.copy(alpha = 0.27f),
                        RoundedCornerShape(23.dp),
                    )
                    .padding(start = 22.dp, end = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = NovaIcons.Search,
                    contentDescription = null,
                    tint = NovaWhite,
                    modifier = Modifier.size(28.dp),
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 16.dp),
                ) {
                    if (query.isEmpty()) {
                        Text(
                            text = "搜索电影、剧集、演员、频道...",
                            color = Color.White.copy(alpha = 0.42f),
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Normal,
                            fontSize = 24.sp,
                        )
                    }
                    innerTextField()
                }
                Text(
                    text = "ENTER 打开",
                    color = Color.White.copy(alpha = 0.44f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    letterSpacing = 0.7.sp,
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(9.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(9.dp))
                        .padding(horizontal = 10.dp, vertical = 7.dp),
                )
            }
        },
    )
}

@Composable
private fun SuggestionChip(
    text: String,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier.height(32.dp),
        shape = RoundedCornerShape(11.dp),
        focusRequester = requester,
        focusedScale = 1.045f,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .background(Color.White.copy(alpha = if (focused) 0.15f else 0.055f), RoundedCornerShape(11.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.14f),
                    RoundedCornerShape(11.dp),
                )
                .padding(horizontal = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                color = if (focused) NovaWhite else Color.White.copy(alpha = 0.61f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun SearchResultRow(
    item: MediaItem,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(76.dp),
        shape = RoundedCornerShape(17.dp),
        focusRequester = requester,
        focusedScale = 1.012f,
        transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0.5f),
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.11f else 0.035f), RoundedCornerShape(17.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.09f),
                    RoundedCornerShape(17.dp),
                )
                .padding(start = 8.dp, end = 13.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(
                painter = painterResource(item.imageRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .width(104.dp)
                    .height(60.dp)
                    .clip(RoundedCornerShape(12.dp)),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 15.dp),
            ) {
                Text(
                    text = item.title,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 17.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = item.meta,
                    color = Color.White.copy(alpha = 0.46f),
                    fontFamily = Manrope,
                    fontSize = 11.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
            Text(
                text = item.type,
                color = Color.White.copy(alpha = 0.56f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 10.5.sp,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 9.dp, vertical = 6.dp),
            )
        }
    }
}
