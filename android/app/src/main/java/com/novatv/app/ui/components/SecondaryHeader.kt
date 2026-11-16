package com.novatv.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaWhite

@Composable
fun SecondaryHeader(
    eyebrow: String,
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    trailing: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NovaIconButton(
            icon = NovaIcons.ArrowBack,
            contentDescription = "返回首页",
            onClick = onBack,
        )
        Column(modifier = Modifier.padding(start = 16.dp)) {
            Text(
                text = eyebrow,
                color = Color.White.copy(alpha = 0.43f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 1.5.sp,
            )
            Text(
                text = title,
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 27.sp,
                letterSpacing = (-0.8).sp,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, content = trailing)
    }
}
