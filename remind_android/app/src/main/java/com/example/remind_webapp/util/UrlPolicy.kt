package com.example.remind_webapp.util

object UrlPolicy {
    /*
     BASE_URL(도메인) : https://google.com/
     ALLOWED_PATH(하위주소) : search/
     */
    private const val BASE_URL = "https://entest.co.kr/test/opic/cbt_entest/record_test.aspx" //https://remind-aa99f.web.app/"
    private const val ALLOWED_PATH = ""

    fun isAllowed(url: String): Boolean {
        if (!url.startsWith(BASE_URL)) return false

        val relativePath = url.removePrefix(BASE_URL)
        return relativePath.startsWith(ALLOWED_PATH)
    }
}
