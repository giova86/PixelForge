from models.schemas import ProcessRequest, JobStarted, ProgressEvent, DoneEvent, ErrorEvent, HealthResponse

def test_process_request_defaults():
    r = ProcessRequest(mode="compress", session_id="test-session")
    assert r.quality == 85
    assert r.scale == 4
    assert r.output_format == "webp"
    assert r.keep_exif is True

def test_done_event_has_output_url():
    e = DoneEvent(output_url="/result/abc", original_size=1000, compressed_size=500,
                  saving_percent=50.0, mode="compress")
    assert e.output_url == "/result/abc"
