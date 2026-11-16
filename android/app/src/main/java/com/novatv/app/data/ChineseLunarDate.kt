package com.novatv.app.data

import android.icu.util.ChineseCalendar
import android.os.Build
import androidx.annotation.RequiresApi
import java.util.Date

object ChineseLunarDate {
    fun label(now: Date = Date()): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return "农历日期"
        }
        return ChineseLunarDateApi24.label(now)
    }
}

@RequiresApi(Build.VERSION_CODES.N)
private object ChineseLunarDateApi24 {
    private val monthNames = arrayOf(
        "正月", "二月", "三月", "四月", "五月", "六月",
        "七月", "八月", "九月", "十月", "冬月", "腊月",
    )

    private val dayNames = arrayOf(
        "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
    )

    fun label(now: Date): String {
        return runCatching {
            val calendar = ChineseCalendar().apply { time = now }
            val month = calendar.get(ChineseCalendar.MONTH)
            val day = calendar.get(ChineseCalendar.DAY_OF_MONTH)
            val leap = calendar.get(ChineseCalendar.IS_LEAP_MONTH) == 1
            buildString {
                append("农历")
                if (leap) append("闰")
                append(monthNames[month.coerceIn(0, 11)])
                append(dayNames[(day - 1).coerceIn(0, 29)])
            }
        }.getOrDefault("农历日期")
    }
}
