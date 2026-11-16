package com.novatv.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class MusicCatalogTest {
    @Test
    fun exposesFourUniqueQueueEntries() {
        assertEquals(4, MusicCatalog.tracks.size)
        assertEquals(4, MusicCatalog.tracks.map { it.id }.distinct().size)
        assertEquals(4, MusicCatalog.tracks.map { it.audioRes }.distinct().size)
        assertEquals("00:24", MusicCatalog.tracks.first().durationLabel)
    }

    @Test
    fun wrapsQueueIndexesInBothDirections() {
        assertEquals(MusicCatalog.tracks.last(), MusicCatalog.trackAt(-1))
        assertEquals(MusicCatalog.tracks.first(), MusicCatalog.trackAt(4))
        assertEquals(MusicCatalog.tracks[2], MusicCatalog.trackAt(2))
        assertNotEquals(MusicCatalog.tracks[0], MusicCatalog.tracks[1])
    }
}
